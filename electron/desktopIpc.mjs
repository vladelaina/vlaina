import { app, dialog, shell } from 'electron';
import { watch } from 'node:fs';
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertAuthorizedFsPath,
  authorizeFsPath,
  canRenameAuthorizedRoot,
  isAuthorizedFsPathKey,
  normalizeFsPathForAccess,
  normalizeFsPathKey,
  updateAuthorizedRootRename,
} from './fsAccess.mjs';

const activeWatchers = new Map();
let watcherCounter = 0;

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
    shell.showItemInFolder(await assertAuthorizedFsPath(filePath));
  });

  handleIpc('desktop:dialog:open', async (event, options) => {
    const window = resolveTargetWindow(event);
    const properties = [];

    if (options?.directory) {
      properties.push('openDirectory');
    } else {
      properties.push('openFile');
    }

    if (options?.multiple) {
      properties.push('multiSelections');
    }

    const result = await dialog.showOpenDialog(window ?? undefined, {
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
      properties,
    });

    if (result.canceled) {
      return null;
    }

    if (options?.multiple) {
      const kind = options?.directory ? 'root' : 'file';
      await Promise.all(result.filePaths.map((filePath) => authorizeFsPath(filePath, kind)));
      return result.filePaths;
    }

    const selectedPath = result.filePaths[0] ?? null;
    if (selectedPath) {
      await authorizeFsPath(selectedPath, options?.directory ? 'root' : 'file');
    }

    return selectedPath;
  });

  handleIpc('desktop:dialog:save', async (event, options) => {
    const window = resolveTargetWindow(event);
    const result = await dialog.showSaveDialog(window ?? undefined, {
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });
    if (result.canceled || !result.filePath) {
      return null;
    }

    await authorizeFsPath(result.filePath, 'file');
    return result.filePath;
  });

  handleIpc('desktop:dialog:message', async (event, message, options) => {
    const window = resolveTargetWindow(event);
    await dialog.showMessageBox(window ?? undefined, {
      type: options?.kind ?? 'info',
      title: options?.title,
      message,
    });
  });

  handleIpc('desktop:dialog:confirm', async (event, message, options) => {
    const window = resolveTargetWindow(event);
    const result = await dialog.showMessageBox(window ?? undefined, {
      type: options?.kind ?? 'question',
      title: options?.title,
      message,
      buttons: ['OK', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
    });

    return result.response === 0;
  });

  handleIpc('desktop:fs:write-binary', async (_event, filePath, bytes) => {
    await writeFile(await assertAuthorizedFsPath(filePath), Buffer.from(bytes));
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
      await writeFile(resolvedPath, previous + String(content ?? ''));
      return;
    }

    await writeFile(resolvedPath, String(content ?? ''));
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

    await rename(resolvedOldPath, resolvedNewPath);
    await updateAuthorizedRootRename(resolvedOldPath, resolvedNewPath);
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

  handleIpc('desktop:path:to-file-url', async (_event, filePath) => {
    return pathToFileURL(await assertAuthorizedFsPath(filePath)).toString();
  });

  handleIpc('desktop:fs:watch', async (event, watchPath) => {
    const resolvedWatchPath = await assertAuthorizedFsPath(watchPath);

    const watchId = `watch-${++watcherCounter}`;
    const sender = event.sender;
    const listener = watch(
      resolvedWatchPath,
      { recursive: true },
      (eventType, filename) => {
        const resolvedPath = filename ? path.join(resolvedWatchPath, filename.toString()) : resolvedWatchPath;
        const payload = eventType === 'rename'
          ? { type: { remove: { kind: 'any' } }, paths: [resolvedPath] }
          : { type: { modify: { kind: 'data', mode: 'any' } }, paths: [resolvedPath] };
        sender.send(`desktop:fs:watch:${watchId}`, payload);
      },
    );

    activeWatchers.set(watchId, listener);
    return watchId;
  });

  handleIpc('desktop:fs:unwatch', (_event, watchId) => {
    const listener = activeWatchers.get(requireNonEmptyString(watchId, 'watch id'));
    if (listener) {
      listener.close();
      activeWatchers.delete(watchId);
    }
  });
}
