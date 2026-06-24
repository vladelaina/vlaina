import electron from 'electron';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  copyFile,
  mkdtemp,
  mkdir,
  open,
  opendir,
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
  assertAuthorizedFsRenameTarget,
  assertAuthorizedFsWatchPath,
  assertSafeFsAccessPath,
  authorizeFsPath,
  updateAuthorizedRootRename,
} from './fsAccess.mjs';

const { app, BrowserWindow, clipboard, dialog, nativeImage, shell } = electron;
const activeAiProviderRequests = new Map();
const HTTP_HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const AI_PROVIDER_HTTP_AUTHORITY_URL_PATTERN = /^https?:\/\//i;
const UNSAFE_AI_PROVIDER_URL_CHARS_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const UNSAFE_DESKTOP_LIST_ENTRY_NAME_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const IPC_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const AI_PROVIDER_TRANSPORT_RETRY_DELAYS_MS = [300];
const AI_PROVIDER_FAST_FAILURE_RETRY_WINDOW_MS = 2000;
const MAX_DESKTOP_FS_READ_BYTES = 64 * 1024 * 1024;
const MAX_DESKTOP_FS_WRITE_BYTES = MAX_DESKTOP_FS_READ_BYTES;
const MAX_DESKTOP_FS_LIST_DIR_ENTRIES = 20_000;
const MAX_DESKTOP_FS_LIST_DIR_SCAN_ENTRIES = MAX_DESKTOP_FS_LIST_DIR_ENTRIES * 2;
const DESKTOP_MARKDOWN_FILE_EXTENSION_PATTERN = /\.(?:md|markdown|mdown|mkd)$/i;
const LOW_PRIORITY_DESKTOP_DIRECTORY_NAMES = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '__pycache__',
]);
const MAX_AI_PROVIDER_REQUEST_BODY_BYTES = 64 * 1024 * 1024;
const MAX_AI_PROVIDER_REQUEST_BODY_BASE64_CHARS = Math.ceil(MAX_AI_PROVIDER_REQUEST_BODY_BYTES / 3) * 4;
const MAX_AI_PROVIDER_RESPONSE_BODY_BYTES = 64 * 1024 * 1024;
const MAX_AI_PROVIDER_RESPONSE_IPC_CHUNK_BYTES = 256 * 1024;
const MAX_AI_PROVIDER_URL_CHARS = 4096;
const MAX_AI_PROVIDER_HEADER_NAME_CHARS = 256;
const MAX_AI_PROVIDER_HEADER_VALUE_CHARS = 16 * 1024;
const MAX_CLIPBOARD_IMAGE_DATA_URL_BYTES = 10 * 1024 * 1024;
const MAX_DESKTOP_EXPORT_HTML_BYTES = 64 * 1024 * 1024;
const MAX_DESKTOP_EXPORT_PDF_BYTES = 64 * 1024 * 1024;

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

function isCurrentAiProviderRequest(requestId, controller) {
  return activeAiProviderRequests.get(requestId) === controller;
}

function summarizeError(error) {
  if (!(error instanceof Error)) {
    if (typeof error === 'string') return error || 'Unknown error';
    if (typeof error === 'number' || typeof error === 'boolean') return String(error);
    return 'Unknown error';
  }

  const cause = error.cause instanceof Error ? `: ${error.cause.message}` : '';
  return `${error.name}: ${error.message}${cause}`;
}

function createAbortError() {
  return new DOMException('Aborted', 'AbortError');
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw createAbortError();
}

async function raceWithAbort(promise, signal) {
  throwIfAborted(signal);
  promise.catch(() => undefined);

  return await new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
    };
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const abort = () => {
      settle(() => reject(createAbortError()));
    };

    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    promise.then(
      (value) => {
        settle(() => {
          try {
            throwIfAborted(signal);
            resolve(value);
          } catch (error) {
            reject(error);
          }
        });
      },
      (error) => {
        settle(() => {
          try {
            throwIfAborted(signal);
            reject(error);
          } catch (abortError) {
            reject(abortError);
          }
        });
      },
    );
  });
}

function delayAiProviderRetry(ms, signal) {
  return new Promise((resolve, reject) => {
    let timeout;
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      reject(createAbortError());
    };
    timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
    }
  });
}

async function fetchAiProviderRequestWithRetry(request, signal) {
  for (let attempt = 0; ; attempt += 1) {
    const startedAt = Date.now();
    try {
      return await raceWithAbort(fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal,
        cache: 'no-store',
      }), signal);
    } catch (error) {
      const retryDelayMs = AI_PROVIDER_TRANSPORT_RETRY_DELAYS_MS[attempt];
      const failedQuickly = Date.now() - startedAt <= AI_PROVIDER_FAST_FAILURE_RETRY_WINDOW_MS;
      if (signal.aborted || retryDelayMs == null || !failedQuickly) {
        throw error;
      }
      await delayAiProviderRetry(retryDelayMs, signal);
    }
  }
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

function escapeGVariantString(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const LINUX_ITEM_REVEALER_CANDIDATES = [
  { command: 'nautilus', args: ['--select'], target: 'item' },
  { command: 'dolphin', args: ['--select'], target: 'item' },
  { command: 'thunar', args: ['--select'], target: 'item' },
  { command: 'nemo', args: [], target: 'folder' },
  { command: 'pcmanfm', args: [], target: 'folder' },
  { command: 'caja', args: [], target: 'folder' },
  { command: 'io.elementary.files', args: [], target: 'folder' },
];

const LINUX_DIRECTORY_OPENER_CANDIDATES = [
  { command: 'nautilus', args: ['--new-window'] },
  { command: 'dolphin', args: ['--new-window'] },
  { command: 'thunar', args: ['--new-window'] },
  { command: 'nemo', args: ['--new-window'] },
  { command: 'pcmanfm', args: [] },
  { command: 'caja', args: [] },
  { command: 'io.elementary.files', args: [] },
];

const LINUX_XDG_OPEN_FOLDER_OPENER = { command: 'xdg-open', args: [], target: 'folder' };

function findLinuxCommandOpener(candidates, options = {}) {
  for (const candidate of candidates) {
    const commandPath = findCommandOnPath(candidate.command, options.envPath, options.exists);
    if (commandPath) {
      return { ...candidate, command: commandPath };
    }
  }

  return null;
}

function getLinuxFileManagerDbusRevealer(filePath, options = {}) {
  const commandPath = findCommandOnPath('gdbus', options.envPath, options.exists);
  if (!commandPath) {
    return null;
  }

  const fileUrl = pathToFileURL(filePath, { windows: false }).toString();
  return {
    command: commandPath,
    args: [
      'call',
      '--session',
      '--dest',
      'org.freedesktop.FileManager1',
      '--object-path',
      '/org/freedesktop/FileManager1',
      '--method',
      'org.freedesktop.FileManager1.ShowItems',
      `['${escapeGVariantString(fileUrl)}']`,
      '',
    ],
    target: 'none',
  };
}

function getLinuxCommandItemRevealer(options = {}) {
  return findLinuxCommandOpener(LINUX_ITEM_REVEALER_CANDIDATES, options)
    ?? LINUX_XDG_OPEN_FOLDER_OPENER;
}

function getLinuxDirectoryOpener(options = {}) {
  return findLinuxCommandOpener(LINUX_DIRECTORY_OPENER_CANDIDATES, options);
}

function getLinuxOpenerTargetPath(filePath, target) {
  if (target === 'none') {
    return null;
  }
  if (target === 'folder') {
    return path.dirname(filePath);
  }
  return filePath;
}

function getLinuxContainingFolderOpener(options = {}) {
  const folderOpener = getLinuxDirectoryOpener(options);
  return folderOpener
    ? { ...folderOpener, target: 'folder' }
    : LINUX_XDG_OPEN_FOLDER_OPENER;
}

function openItemWithLinuxFileManager(filePath, options = {}) {
  const opener = options.opener ?? getLinuxCommandItemRevealer(options);
  const { command, args, target } = opener;
  const spawnDetached = options.spawnDetached ?? spawn;
  const fallbackShell = options.fallbackShell ?? shell;
  const folderPath = path.dirname(filePath);
  const targetPath = getLinuxOpenerTargetPath(filePath, target);
  const spawnArgs = targetPath === null ? args : [...args, targetPath];
  let didFallback = false;

  const fallbackToContainingFolder = () => {
    if (didFallback) {
      return;
    }
    didFallback = true;

    if (options.disableFallback) {
      return;
    }

    if (target === 'folder') {
      if (path.basename(command) === 'xdg-open') {
        void fallbackShell.openPath?.(folderPath);
        return;
      }

      openItemWithLinuxFileManager(filePath, {
        ...options,
        opener: { command: 'xdg-open', args: [], target: 'folder' },
      });
      return;
    }

    openItemWithLinuxFileManager(filePath, {
      ...options,
      opener: getLinuxContainingFolderOpener(options),
    });
  };

  const child = spawnDetached(command, spawnArgs, {
    detached: true,
    stdio: 'ignore',
  });

  child.once?.('error', fallbackToContainingFolder);
  child.once?.('exit', (code) => {
    if (code !== 0) {
      fallbackToContainingFolder();
    }
  });
  child.unref?.();
}

export async function openPathInFileManager(filePath, options = {}) {
  const platform = options.platform ?? process.platform;
  const shellImpl = options.shellImpl ?? shell;

  if (platform !== 'linux') {
    const errorMessage = await shellImpl.openPath(filePath);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
    return;
  }

  const opener = options.opener ?? getLinuxDirectoryOpener(options);
  if (!opener) {
    throw new Error('No supported Linux file manager was found for opening folders.');
  }

  const spawnDetached = options.spawnDetached ?? spawn;
  const child = spawnDetached(opener.command, [...opener.args, filePath], {
    detached: true,
    stdio: 'ignore',
  });
  child.once?.('error', () => {});
  child.unref?.();
}

export async function revealItemInFolder(filePath, options = {}) {
  const platform = options.platform ?? process.platform;
  const shellImpl = options.shellImpl ?? shell;

  if (platform === 'linux') {
    // DBus is desktop-neutral; the direct command covers file managers that do not honor DBus selection reliably.
    const dbusOpener = getLinuxFileManagerDbusRevealer(filePath, options);
    if (dbusOpener) {
      openItemWithLinuxFileManager(filePath, {
        ...options,
        fallbackShell: shellImpl,
        opener: dbusOpener,
        disableFallback: true,
      });
    }

    openItemWithLinuxFileManager(filePath, {
      ...options,
      fallbackShell: shellImpl,
      opener: getLinuxCommandItemRevealer(options),
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
  const id = typeof value === 'string' ? value.trim() : '';
  if (!IPC_REQUEST_ID_PATTERN.test(id)) {
    throw new Error(`${label} must contain only safe channel characters.`);
  }
  return id;
}

function normalizeDesktopReadByteLimit(value) {
  if (value == null) {
    return MAX_DESKTOP_FS_READ_BYTES;
  }
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_DESKTOP_FS_READ_BYTES) {
    throw new Error('Desktop read byte limit is invalid.');
  }
  return value;
}

async function assertReadableDesktopFile(filePath, maxBytes) {
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error(`Desktop path must be a file: ${filePath}`);
  }
  if (info.size > maxBytes) {
    throw new Error(`Desktop file is too large to read: ${filePath}`);
  }
}

async function assertCopyableDesktopFile(filePath) {
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error(`Desktop path must be a file: ${filePath}`);
  }
  if (info.size > MAX_DESKTOP_FS_WRITE_BYTES) {
    throw new Error(`Desktop file is too large to copy: ${filePath}`);
  }
}

async function readDesktopFileBytes(filePath, maxBytesValue) {
  const maxBytes = normalizeDesktopReadByteLimit(maxBytesValue);
  await assertReadableDesktopFile(filePath, maxBytes);

  const handle = await open(filePath, 'r');
  const chunks = [];
  let totalBytes = 0;
  try {
    while (totalBytes <= maxBytes) {
      const remainingBytes = maxBytes + 1 - totalBytes;
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, Math.max(1, remainingBytes)));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) {
        break;
      }
      chunks.push(buffer.subarray(0, bytesRead));
      totalBytes += bytesRead;
    }
  } finally {
    await handle.close().catch(() => {});
  }

  if (totalBytes > maxBytes) {
    throw new Error(`Desktop file is too large to read: ${filePath}`);
  }
  return Buffer.concat(chunks, totalBytes);
}

function assertWritableDesktopByteLength(byteLength) {
  if (!Number.isSafeInteger(byteLength) || byteLength > MAX_DESKTOP_FS_WRITE_BYTES) {
    throw new Error('Desktop content is too large to write.');
  }
}

async function describeDesktopDirectoryEntry(parentPath, entry) {
  const entryPath = path.join(parentPath, entry.name);
  if (!entry.isSymbolicLink?.()) {
    return {
      name: entry.name,
      path: entryPath,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    };
  }

  try {
    const authorizedEntryPath = await assertAuthorizedFsPath(entryPath);
    const info = await stat(authorizedEntryPath);
    return {
      name: entry.name,
      path: entryPath,
      isDirectory: info.isDirectory(),
      isFile: info.isFile(),
    };
  } catch {
    return {
      name: entry.name,
      path: entryPath,
      isDirectory: false,
      isFile: false,
    };
  }
}

function getDesktopDirectoryEntryListPriority(entry) {
  const entryName = String(entry.name);
  if (
    !entryName ||
    entryName === '.' ||
    entryName === '..' ||
    entryName.includes('/') ||
    entryName.includes('\\') ||
    UNSAFE_DESKTOP_LIST_ENTRY_NAME_PATTERN.test(entryName)
  ) {
    return 4;
  }

  if (DESKTOP_MARKDOWN_FILE_EXTENSION_PATTERN.test(entry.name)) {
    return 0;
  }

  if (entry.isDirectory?.() || entry.isSymbolicLink?.()) {
    return LOW_PRIORITY_DESKTOP_DIRECTORY_NAMES.has(entryName.toLowerCase()) ? 2 : 1;
  }

  return 3;
}

function prioritizeDesktopDirectoryEntriesForListing(entries) {
  return entries
    .map((entry, index) => ({ entry, index, priority: getDesktopDirectoryEntryListPriority(entry) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ entry }) => entry);
}

async function readDesktopDirectoryEntriesForListing(directoryPath) {
  let directory = null;
  const entries = [];
  try {
    directory = await opendir(directoryPath);
    for await (const entry of directory) {
      entries.push(entry);
      if (entries.length >= MAX_DESKTOP_FS_LIST_DIR_SCAN_ENTRIES) {
        break;
      }
    }
  } finally {
    await directory?.close?.().catch(() => {});
  }
  return entries;
}

function normalizeDesktopBinaryWriteBytes(bytes) {
  if (bytes instanceof Uint8Array) {
    assertWritableDesktopByteLength(bytes.byteLength);
    return Buffer.from(bytes);
  }

  if (Array.isArray(bytes)) {
    assertWritableDesktopByteLength(bytes.length);
    const normalized = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) {
      const byte = bytes[index];
      if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
        throw new Error('Desktop binary content must contain only byte values.');
      }
      normalized[index] = byte;
    }
    return Buffer.from(normalized);
  }

  throw new Error('Desktop binary content must be a byte array.');
}

function assertDesktopExportHtmlBytes(html) {
  if (Buffer.byteLength(html, 'utf8') > MAX_DESKTOP_EXPORT_HTML_BYTES) {
    throw new Error('PDF export HTML is too large.');
  }
}

function assertDesktopExportPdfBytes(byteLength) {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > MAX_DESKTOP_EXPORT_PDF_BYTES) {
    throw new Error('PDF export output is too large.');
  }
}

function normalizeDesktopTextWriteContent(content) {
  if (typeof content !== 'string') {
    throw new Error('Desktop text content must be a string.');
  }
  const text = content;
  assertWritableDesktopByteLength(Buffer.byteLength(text, 'utf8'));
  return text;
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
  assertDesktopExportHtmlBytes(html);

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
    const pdfBytes = await win.webContents.printToPDF(normalizeExportPdfOptions(options));
    assertDesktopExportPdfBytes(pdfBytes?.byteLength);
    return pdfBytes;
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
  const method = rawRequest.method == null
    ? 'GET'
    : typeof rawRequest.method === 'string'
      ? rawRequest.method.toUpperCase()
      : '';
  if (method !== 'GET' && method !== 'POST') {
    throw new Error(`Unsupported AI provider request method: ${method}`);
  }

  const headers = normalizeAiProviderHeaders(rawRequest.headers);
  const body = normalizeAiProviderRequestBody(rawRequest);
  return { url, method, headers, body };
}

function normalizeAiProviderRequestBody(rawRequest) {
  if (rawRequest.bodyBase64 != null) {
    if (typeof rawRequest.bodyBase64 !== 'string') {
      throw new Error('Invalid AI provider base64 request body.');
    }
    const bodyBase64 = rawRequest.bodyBase64;
    if (bodyBase64.length > MAX_AI_PROVIDER_REQUEST_BODY_BASE64_CHARS) {
      throw new Error('AI provider request body is too large.');
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(bodyBase64) || bodyBase64.length % 4 !== 0) {
      throw new Error('Invalid AI provider base64 request body.');
    }
    const decodedByteLength = getBase64DecodedByteLength(bodyBase64);
    if (decodedByteLength === null || decodedByteLength > MAX_AI_PROVIDER_REQUEST_BODY_BYTES) {
      throw new Error('AI provider request body is too large.');
    }
    return Buffer.from(bodyBase64, 'base64');
  }

  if (rawRequest.body == null) {
    return undefined;
  }

  if (typeof rawRequest.body !== 'string') {
    throw new Error('Invalid AI provider request body.');
  }
  const body = rawRequest.body;
  if (Buffer.byteLength(body, 'utf8') > MAX_AI_PROVIDER_REQUEST_BODY_BYTES) {
    throw new Error('AI provider request body is too large.');
  }
  return body;
}

function getBase64DecodedByteLength(payload) {
  if (payload.length % 4 !== 0) {
    return null;
  }

  let padding = 0;
  if (payload.endsWith('==')) {
    padding = 2;
  } else if (payload.endsWith('=')) {
    padding = 1;
  }

  const byteLength = Math.floor((payload.length * 3) / 4) - padding;
  return byteLength >= 0 ? byteLength : null;
}

function assertClipboardImageDataUrl(dataUrl) {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid clipboard image data URL');
  }

  const byteLength = getBase64DecodedByteLength(match[1]);
  if (byteLength === null || byteLength > MAX_CLIPBOARD_IMAGE_DATA_URL_BYTES) {
    throw new Error('Clipboard image data URL is too large.');
  }
}

function normalizeAiProviderUrl(rawUrl) {
  if (typeof rawUrl !== 'string') {
    throw new Error('A non-empty AI provider URL is required.');
  }
  if (rawUrl.length > MAX_AI_PROVIDER_URL_CHARS) {
    throw new Error('AI provider request URL is not supported.');
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('A non-empty AI provider URL is required.');
  }
  if (
    trimmed.length > MAX_AI_PROVIDER_URL_CHARS ||
    !AI_PROVIDER_HTTP_AUTHORITY_URL_PATTERN.test(trimmed) ||
    UNSAFE_AI_PROVIDER_URL_CHARS_PATTERN.test(trimmed) ||
    trimmed.includes('\\')
  ) {
    throw new Error('AI provider request URL is not supported.');
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('AI provider request URL is not supported.');
  }

  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error('AI provider request URL is not supported.');
  }

  return parsed.toString();
}

function normalizeAiProviderHeaders(rawHeaders) {
  const headers = {};
  if (!rawHeaders || typeof rawHeaders !== 'object') {
    return headers;
  }

  for (const [key, value] of Object.entries(rawHeaders)) {
    if (key.length > MAX_AI_PROVIDER_HEADER_NAME_CHARS) {
      throw new Error(`Invalid AI provider request header: ${key.slice(0, MAX_AI_PROVIDER_HEADER_NAME_CHARS)}`);
    }
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      continue;
    }
    if (normalizedKey.length > MAX_AI_PROVIDER_HEADER_NAME_CHARS) {
      throw new Error(`Invalid AI provider request header: ${normalizedKey}`);
    }
    if (value == null) {
      continue;
    }
    if (!HTTP_HEADER_NAME_PATTERN.test(normalizedKey)) {
      throw new Error(`Invalid AI provider request header: ${normalizedKey}`);
    }
    let normalizedValue = '';
    if (typeof value === 'string') {
      normalizedValue = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      normalizedValue = String(value);
    } else if (typeof value === 'boolean') {
      normalizedValue = String(value);
    } else {
      throw new Error(`Invalid AI provider request header value: ${normalizedKey}`);
    }
    if (normalizedValue.length > MAX_AI_PROVIDER_HEADER_VALUE_CHARS) {
      throw new Error(`Invalid AI provider request header value: ${normalizedKey}`);
    }
    if (/[\u0000\r\n]/.test(normalizedValue)) {
      throw new Error(`Invalid AI provider request header value: ${normalizedKey}`);
    }
    headers[normalizedKey] = normalizedValue;
  }

  return headers;
}

function sendAiProviderResponseChunk(sendRequestEvent, value) {
  if (value.byteLength <= MAX_AI_PROVIDER_RESPONSE_IPC_CHUNK_BYTES) {
    return sendRequestEvent('chunk', Array.from(value));
  }

  for (let offset = 0; offset < value.byteLength; offset += MAX_AI_PROVIDER_RESPONSE_IPC_CHUNK_BYTES) {
    const chunk = value.subarray(offset, offset + MAX_AI_PROVIDER_RESPONSE_IPC_CHUNK_BYTES);
    if (!sendRequestEvent('chunk', Array.from(chunk))) {
      return false;
    }
  }

  return true;
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

  handleIpc('desktop:shell:open-path', async (_event, filePath) => {
    const resolvedPath = await assertAuthorizedFsPath(filePath);
    await openPathInFileManager(resolvedPath);
  });

  handleIpc('desktop:shell:trash-item', async (_event, filePath) => {
    const resolvedPath = await assertAuthorizedFsPath(filePath);
    await shell.trashItem(resolvedPath);
  });

  handleIpc('desktop:shell:reveal-item', async (_event, filePath) => {
    const resolvedPath = await assertAuthorizedFsPath(filePath);
    await revealItemInFolder(resolvedPath);
  });

  handleIpc('desktop:clipboard:write-text', async (_event, text) => {
    clipboard.writeText(typeof text === 'string' ? text : '');
  });

  handleIpc('desktop:clipboard:write-image', async (_event, dataUrl) => {
    const normalizedDataUrl = typeof dataUrl === 'string' ? dataUrl : '';
    assertClipboardImageDataUrl(normalizedDataUrl);

    const image = nativeImage.createFromDataURL(normalizedDataUrl);
    if (image.isEmpty()) {
      throw new Error('Invalid clipboard image data');
    }

    clipboard.writeImage(image);
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
    const sendRequestEvent = (suffix, payload) => {
      if (!isCurrentAiProviderRequest(id, controller)) {
        return false;
      }
      return safeSend(sender, `desktop:ai-provider:request:${id}:${suffix}`, payload);
    };

    let response;
    try {
      response = await fetchAiProviderRequestWithRetry(request, controller.signal);
    } catch (error) {
      deleteActiveAiProviderRequest(id, controller);
      if (controller.signal.aborted) {
        throw error;
      }
      throw new Error(`连接到自定义渠道失败，可能是上游或网络瞬时不可达，可重试。AI provider request to ${request.url} failed before an HTTP response was received: ${summarizeError(error)}`);
    }

    void (async () => {
      try {
        if (!response.body) {
          sendRequestEvent('done');
          return;
        }

        const reader = response.body.getReader();
        const cancelReader = () => {
          void reader.cancel(createAbortError()).catch(() => {});
        };
        controller.signal.addEventListener('abort', cancelReader, { once: true });
        try {
          if (controller.signal.aborted) {
            throw createAbortError();
          }

          let responseBytesRead = 0;
          while (true) {
            const { done, value } = await raceWithAbort(reader.read(), controller.signal);
            if (controller.signal.aborted) {
              throw createAbortError();
            }
            if (done) {
              break;
            }
            const chunkByteLength = value?.byteLength;
            if (!Number.isFinite(chunkByteLength) || chunkByteLength < 0) {
              throw new Error('Invalid AI provider response chunk.');
            }
            responseBytesRead += chunkByteLength;
            if (responseBytesRead > MAX_AI_PROVIDER_RESPONSE_BODY_BYTES) {
              throw new Error('AI provider response body is too large.');
            }

            if (!sendAiProviderResponseChunk(sendRequestEvent, value)) {
              controller.abort();
              throw createAbortError();
            }
          }

          sendRequestEvent('done');
        } catch (error) {
          void reader.cancel(createAbortError()).catch(() => {});
          throw error;
        } finally {
          controller.signal.removeEventListener('abort', cancelReader);
          reader.releaseLock();
        }
      } catch (error) {
        if (controller.signal.aborted) {
          if (isCurrentAiProviderRequest(id, controller)) {
            safeSend(sender, `desktop:ai-provider:request:${id}:error`, {
              message: 'Aborted',
            });
          }
          return;
        }
        sendRequestEvent('error', {
          message: error instanceof Error ? error.message : summarizeError(error),
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
    const resolvedPath = await assertSafeFsAccessPath(filePath);
    const info = await stat(resolvedPath);
    if (!info.isDirectory()) {
      await authorizeFsPath(resolvedPath, 'file');
    }
    await authorizeFsPath(info.isDirectory() ? resolvedPath : path.dirname(resolvedPath), 'root');

    return {
      name: path.basename(resolvedPath),
      path: resolvedPath,
      isDirectory: info.isDirectory(),
      isFile: info.isFile(),
      size: info.size,
      createdAt: info.birthtimeMs,
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
    await writeFileAtomically(
      await assertAuthorizedFsPath(filePath),
      normalizeDesktopBinaryWriteBytes(bytes),
    );
  });

  handleIpc('desktop:fs:read-binary', async (_event, filePath, maxBytes) => {
    return new Uint8Array(await readDesktopFileBytes(await assertAuthorizedFsPath(filePath), maxBytes));
  });

  handleIpc('desktop:fs:read-text', async (_event, filePath, maxBytes) => {
    return (await readDesktopFileBytes(await assertAuthorizedFsPath(filePath), maxBytes)).toString('utf8');
  });

  handleIpc('desktop:fs:write-text', async (_event, filePath, content, options) => {
    const resolvedPath = await assertAuthorizedFsPath(filePath);
    const text = normalizeDesktopTextWriteContent(content);

    if (options?.recursive) {
      await mkdir(path.dirname(resolvedPath), { recursive: true });
    }

    if (options?.append) {
      const previous = await readDesktopFileBytes(resolvedPath)
        .then((bytes) => bytes.toString('utf8'))
        .catch((error) => {
          if (error && typeof error === 'object' && error.code === 'ENOENT') {
            return '';
          }
          throw error;
        });
      assertWritableDesktopByteLength(
        Buffer.byteLength(previous, 'utf8') + Buffer.byteLength(text, 'utf8'),
      );
      await writeFileAtomically(resolvedPath, previous + text);
      return;
    }

    await writeFileAtomically(resolvedPath, text);
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
      entries = await readDesktopDirectoryEntriesForListing(resolvedPath);
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
    const result = [];
    const prioritizedEntries = entries.length > MAX_DESKTOP_FS_LIST_DIR_ENTRIES
      ? prioritizeDesktopDirectoryEntriesForListing(entries)
      : entries;
    for (const entry of prioritizedEntries) {
      if (result.length >= MAX_DESKTOP_FS_LIST_DIR_ENTRIES) {
        break;
      }
      result.push(await describeDesktopDirectoryEntry(resolvedPath, entry));
    }
    return result;
  });

  handleIpc('desktop:fs:rename', async (_event, oldPath, newPath) => {
    const resolvedOldPath = await assertAuthorizedFsPath(oldPath);
    const resolvedNewPath = await assertAuthorizedFsRenameTarget(resolvedOldPath, newPath);
    const oldInfo = await stat(resolvedOldPath);
    if (oldInfo.isDirectory() && isPathInsideDirectory(resolvedOldPath, resolvedNewPath)) {
      throw new Error(`Cannot move a directory into itself: ${resolvedOldPath}`);
    }

    await rename(resolvedOldPath, resolvedNewPath);
    await updateAuthorizedRootRename(resolvedOldPath, resolvedNewPath);
    notifyDesktopWatchRename(resolvedOldPath, resolvedNewPath);
  });

  handleIpc('desktop:fs:copy-file', async (_event, sourcePath, targetPath) => {
    const resolvedSourcePath = await assertAuthorizedFsPath(sourcePath);
    await assertCopyableDesktopFile(resolvedSourcePath);
    await copyFile(resolvedSourcePath, await assertAuthorizedFsPath(targetPath));
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
        createdAt: info.birthtimeMs,
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
