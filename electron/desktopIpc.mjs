import electron from 'electron';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  copyFile,
  mkdtemp,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerDesktopDialogIpc } from './desktopDialogIpc.mjs';
import { notifyDesktopWatchRename, registerDesktopWatchIpc } from './desktopWatchIpc.mjs';
import {
  assertAuthorizedFsPath,
  assertAuthorizedFsWatchPath,
  authorizeFsPath,
  canRenameAuthorizedRoot,
  isAuthorizedFsPathKey,
  normalizeFsPathForAccess,
  normalizeFsPathKey,
  updateAuthorizedRootRename,
} from './fsAccess.mjs';

const { app, BrowserWindow, clipboard, dialog, shell } = electron;
const activeAiProviderRequests = new Map();
const HTTP_HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const IPC_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;

async function syncDirectoryBestEffort(dirPath) {
  let handle = null;
  try {
    handle = await open(dirPath, 'r');
    await handle.sync();
  } catch {
    // Directory fsync is not supported on every platform/filesystem.
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function writeFileAtomically(filePath, content, options = {}) {
  const openFile = options.openFile ?? open;
  const dirPath = path.dirname(filePath);
  const baseName = path.basename(filePath);
  const tempPath = path.join(
    dirPath,
    `.${baseName}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  let handle = null;
  try {
    handle = await openFile(tempPath, 'w');
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(tempPath, filePath);
    await syncDirectoryBestEffort(dirPath);
  } catch (error) {
    await handle?.close().catch(() => {});
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

function deleteActiveAiProviderRequest(requestId, controller) {
  if (activeAiProviderRequests.get(requestId) === controller) {
    activeAiProviderRequests.delete(requestId);
  }
}

function summarizeError(error) {
  if (!(error instanceof Error)) {
    return String(error || 'Unknown error');
  }

  const cause = error.cause instanceof Error ? `: ${error.cause.message}` : '';
  return `${error.name}: ${error.message}${cause}`;
}

function findCommandOnPath(command, envPath = process.env.PATH, exists = existsSync) {
  if (!envPath) {
    return null;
  }

  for (const dirPath of envPath.split(path.delimiter)) {
    const commandPath = path.posix.join(dirPath, command);
    if (exists(commandPath)) {
      return commandPath;
    }
  }

  return null;
}

function getLinuxFolderOpener(options = {}) {
  const candidates = [
    { command: 'nautilus', args: ['--new-window'] },
    { command: 'dolphin', args: [] },
    { command: 'nemo', args: [] },
    { command: 'thunar', args: [] },
    { command: 'pcmanfm', args: [] },
    { command: 'caja', args: [] },
    { command: 'io.elementary.files', args: [] },
  ];

  for (const candidate of candidates) {
    const commandPath = findCommandOnPath(candidate.command, options.envPath, options.exists);
    if (commandPath) {
      return { command: commandPath, args: candidate.args };
    }
  }

  return { command: 'xdg-open', args: [] };
}

function openFolderWithLinuxFileManager(folderPath, options = {}) {
  const { command, args } = options.opener ?? getLinuxFolderOpener(options);
  const spawnDetached = options.spawnDetached ?? spawn;
  const fallbackShell = options.fallbackShell ?? shell;
  const child = spawnDetached(command, [...args, folderPath], {
    detached: true,
    stdio: 'ignore',
  });

  child.once?.('error', () => {
    if (path.basename(command) !== 'xdg-open') {
      openFolderWithLinuxFileManager(folderPath, {
        ...options,
        opener: { command: 'xdg-open', args: [] },
      });
      return;
    }
    void fallbackShell.openPath?.(folderPath);
  });
  child.unref?.();
}

export async function revealItemInFolder(filePath, options = {}) {
  const platform = options.platform ?? process.platform;
  const shellImpl = options.shellImpl ?? shell;

  if (platform === 'linux') {
    openFolderWithLinuxFileManager(path.dirname(filePath), {
      ...options,
      fallbackShell: shellImpl,
    });
    return;
  }

  shellImpl.showItemInFolder(filePath);
}

function safeSend(sender, channel, payload) {
  if (!sender || sender.isDestroyed()) {
    return false;
  }

  try {
    sender.send(channel, payload);
    return true;
  } catch {
    return false;
  }
}

export function isPathInsideDirectory(parentPath, candidatePath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function requireSafeIpcRequestId(value, label) {
  const id = String(value ?? '').trim();
  if (!IPC_REQUEST_ID_PATTERN.test(id)) {
    throw new Error(`${label} must contain only safe channel characters.`);
  }
  return id;
}

function normalizeExportPdfOptions(options) {
  const pageSize = options?.pageSize === 'Letter' ? 'Letter' : 'A4';
  return {
    landscape: Boolean(options?.landscape),
    pageSize,
    printBackground: true,
    margins: {
      marginType: 'custom',
      top: 0.4,
      bottom: 0.45,
      left: 0.45,
      right: 0.45,
    },
  };
}

async function renderHtmlToPdf(html, options) {
  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('HTML content is required for PDF export.');
  }

  const tempDir = await mkdtemp(path.join(app.getPath('temp'), 'vlaina-export-'));
  const tempHtmlPath = path.join(tempDir, 'export.html');

  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      contextIsolation: true,
      javascript: false,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    await writeFile(tempHtmlPath, html, 'utf8');
    await win.loadFile(tempHtmlPath);
    await new Promise((resolve) => setTimeout(resolve, 80));
    return await win.webContents.printToPDF(normalizeExportPdfOptions(options));
  } finally {
    if (!win.isDestroyed()) {
      win.destroy();
    }
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function normalizeAiProviderRequest(rawRequest) {
  if (!rawRequest || typeof rawRequest !== 'object') {
    throw new Error('AI provider request is required.');
  }

  const url = normalizeAiProviderUrl(rawRequest.url);
  const method = String(rawRequest.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    throw new Error(`Unsupported AI provider request method: ${method}`);
  }

  const headers = normalizeAiProviderHeaders(rawRequest.headers);
  const body = rawRequest.body == null ? undefined : String(rawRequest.body);
  return { url, method, headers, body };
}

function normalizeAiProviderUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('A non-empty AI provider URL is required.');
  }

  const parsed = new URL(rawUrl.trim());
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported AI provider URL protocol: ${parsed.protocol}`);
  }

  return parsed.toString();
}

function normalizeAiProviderHeaders(rawHeaders) {
  const headers = {};
  if (!rawHeaders || typeof rawHeaders !== 'object') {
    return headers;
  }

  for (const [key, value] of Object.entries(rawHeaders)) {
    const normalizedKey = String(key).trim();
    if (!normalizedKey) {
      continue;
    }
    if (value == null) {
      continue;
    }
    if (!HTTP_HEADER_NAME_PATTERN.test(normalizedKey)) {
      throw new Error(`Invalid AI provider request header: ${normalizedKey}`);
    }
    const normalizedValue = String(value);
    if (/[\u0000\r\n]/.test(normalizedValue)) {
      throw new Error(`Invalid AI provider request header value: ${normalizedKey}`);
    }
    headers[normalizedKey] = normalizedValue;
  }

  return headers;
}

export function registerDesktopIpc({
  handleIpc,
  normalizeExternalUrl,
  resolveTargetWindow,
  requireNonEmptyString,
  requireStringArray,
}) {
  handleIpc('desktop:shell:open-external', async (_event, url) => {
    await shell.openExternal(normalizeExternalUrl(url));
  });

  handleIpc('desktop:shell:trash-item', async (_event, filePath) => {
    const resolvedPath = await assertAuthorizedFsPath(filePath);
    await shell.trashItem(resolvedPath);
  });

  handleIpc('desktop:shell:reveal-item', async (_event, filePath) => {
    await revealItemInFolder(await assertAuthorizedFsPath(filePath));
  });

  handleIpc('desktop:clipboard:write-text', async (_event, text) => {
    clipboard.writeText(String(text ?? ''));
  });

  handleIpc('desktop:export:html-to-pdf', async (_event, html, options) => {
    return new Uint8Array(await renderHtmlToPdf(html, options));
  });

  handleIpc('desktop:ai-provider:request:start', async (event, requestId, rawRequest) => {
    const id = requireSafeIpcRequestId(requestId, 'AI provider request id');
    const previous = activeAiProviderRequests.get(id);
    previous?.abort();

    const request = normalizeAiProviderRequest(rawRequest);
    const controller = new AbortController();
    activeAiProviderRequests.set(id, controller);
    const sender = event.sender;

    let response;
    try {
      response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (error) {
      deleteActiveAiProviderRequest(id, controller);
      throw new Error(`AI provider request to ${request.url} failed before an HTTP response was received: ${summarizeError(error)}`);
    }

    void (async () => {
      try {
        if (!response.body) {
          safeSend(sender, `desktop:ai-provider:request:${id}:done`);
          return;
        }

        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          if (!safeSend(sender, `desktop:ai-provider:request:${id}:chunk`, Array.from(value))) {
            controller.abort();
            return;
          }
        }

        safeSend(sender, `desktop:ai-provider:request:${id}:done`);
      } catch (error) {
        safeSend(sender, `desktop:ai-provider:request:${id}:error`, {
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        deleteActiveAiProviderRequest(id, controller);
      }
    })();

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
    };
  });

  handleIpc('desktop:ai-provider:request:cancel', async (_event, requestId) => {
    const id = requireSafeIpcRequestId(requestId, 'AI provider request id');
    const controller = activeAiProviderRequests.get(id);
    if (controller) {
      controller.abort();
      deleteActiveAiProviderRequest(id, controller);
    }
  });

  handleIpc('desktop:drag-drop:authorize-path', async (_event, filePath) => {
    const resolvedPath = normalizeFsPathForAccess(filePath);
    const info = await stat(resolvedPath);
    const authorizedPath = info.isDirectory() ? resolvedPath : path.dirname(resolvedPath);
    await authorizeFsPath(authorizedPath, 'root');

    return {
      name: path.basename(resolvedPath),
      path: resolvedPath,
      isDirectory: info.isDirectory(),
      isFile: info.isFile(),
      size: info.size,
      modifiedAt: info.mtimeMs,
    };
  });

  registerDesktopDialogIpc({
    app,
    dialog,
    handleIpc,
    resolveTargetWindow,
    authorizeFsPath,
  });

  handleIpc('desktop:fs:write-binary', async (_event, filePath, bytes) => {
    await writeFileAtomically(await assertAuthorizedFsPath(filePath), Buffer.from(bytes));
  });

  handleIpc('desktop:fs:read-binary', async (_event, filePath) => {
    return new Uint8Array(await readFile(await assertAuthorizedFsPath(filePath)));
  });

  handleIpc('desktop:fs:read-text', async (_event, filePath) => {
    return readFile(await assertAuthorizedFsPath(filePath), 'utf8');
  });

  handleIpc('desktop:fs:write-text', async (_event, filePath, content, options) => {
    const resolvedPath = await assertAuthorizedFsPath(filePath);

    if (options?.recursive) {
      await mkdir(path.dirname(resolvedPath), { recursive: true });
    }

    if (options?.append) {
      const previous = await readFile(resolvedPath, 'utf8').catch(() => '');
      await writeFileAtomically(resolvedPath, previous + String(content ?? ''));
      return;
    }

    await writeFileAtomically(resolvedPath, String(content ?? ''));
  });

  handleIpc('desktop:fs:exists', async (_event, filePath) => {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return false;
    }

    try {
      await stat(await assertAuthorizedFsPath(filePath));
      return true;
    } catch {
      return false;
    }
  });

  handleIpc('desktop:fs:mkdir', async (_event, filePath, recursive) => {
    await mkdir(await assertAuthorizedFsPath(filePath), { recursive: Boolean(recursive) });
  });

  handleIpc('desktop:fs:delete-file', async (_event, filePath) => {
    await rm(await assertAuthorizedFsPath(filePath), { force: true });
  });

  handleIpc('desktop:fs:delete-dir', async (_event, filePath, recursive) => {
    await rm(await assertAuthorizedFsPath(filePath), { recursive: Boolean(recursive), force: true });
  });

  handleIpc('desktop:fs:list-dir', async (_event, filePath) => {
    const resolvedPath = await assertAuthorizedFsPath(filePath);

    let entries;
    try {
      entries = await readdir(resolvedPath, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
    return entries.map((entry) => ({
      name: entry.name,
      path: path.join(resolvedPath, entry.name),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  });

  handleIpc('desktop:fs:rename', async (_event, oldPath, newPath) => {
    const resolvedOldPath = await assertAuthorizedFsPath(oldPath);
    const resolvedNewPath = normalizeFsPathForAccess(newPath);
    if (!isAuthorizedFsPathKey(normalizeFsPathKey(resolvedNewPath)) && !canRenameAuthorizedRoot(resolvedOldPath, resolvedNewPath)) {
      throw new Error(`File path is not authorized for desktop access: ${resolvedNewPath}`);
    }
    const oldInfo = await stat(resolvedOldPath);
    if (oldInfo.isDirectory() && isPathInsideDirectory(resolvedOldPath, resolvedNewPath)) {
      throw new Error(`Cannot move a directory into itself: ${resolvedOldPath}`);
    }

    await rename(resolvedOldPath, resolvedNewPath);
    await updateAuthorizedRootRename(resolvedOldPath, resolvedNewPath);
    notifyDesktopWatchRename(resolvedOldPath, resolvedNewPath);
  });

  handleIpc('desktop:fs:copy-file', async (_event, sourcePath, targetPath) => {
    await copyFile(await assertAuthorizedFsPath(sourcePath), await assertAuthorizedFsPath(targetPath));
  });

  handleIpc('desktop:fs:stat', async (_event, filePath) => {
    const resolvedPath = await assertAuthorizedFsPath(filePath);
    try {
      const info = await stat(resolvedPath);
      return {
        name: path.basename(resolvedPath),
        path: resolvedPath,
        isDirectory: info.isDirectory(),
        isFile: info.isFile(),
        size: info.size,
        modifiedAt: info.mtimeMs,
      };
    } catch {
      return null;
    }
  });

  handleIpc('desktop:path:join', (_event, ...segments) => {
    return path.join(...requireStringArray(segments, 'path segment'));
  });

  handleIpc('desktop:path:app-data', () => {
    return app.getPath('userData');
  });

  handleIpc('desktop:path:home', () => {
    return app.getPath('home');
  });

  handleIpc('desktop:path:to-file-url', async (_event, filePath) => {
    return pathToFileURL(await assertAuthorizedFsPath(filePath)).toString();
  });

  registerDesktopWatchIpc({
    handleIpc,
    requireNonEmptyString,
    assertAuthorizedFsWatchPath,
  });
}
