import { watch } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const activeWatchers = new Map();
let watcherCounter = 0;

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

export async function createDesktopWatchPayload(eventType, resolvedPath, statPath = stat) {
  if (eventType !== 'rename') {
    return {
      type: { modify: { kind: 'data', mode: 'any' } },
      paths: [resolvedPath],
    };
  }

  try {
    const info = await statPath(resolvedPath);
    return {
      type: { create: { kind: info.isDirectory() ? 'folder' : 'file' } },
      paths: [resolvedPath],
    };
  } catch {
    return {
      type: { remove: { kind: 'any' } },
      paths: [resolvedPath],
    };
  }
}

export function registerDesktopWatchIpc({
  handleIpc,
  requireNonEmptyString,
  assertAuthorizedFsWatchPath,
}) {
  handleIpc('desktop:fs:watch', async (event, watchPath) => {
    const resolvedWatchPath = await assertAuthorizedFsWatchPath(watchPath);
    const watchId = `watch-${++watcherCounter}`;
    const sender = event.sender;
    const listener = watch(resolvedWatchPath, (eventType, filename) => {
      const resolvedPath = filename ? path.join(resolvedWatchPath, filename.toString()) : resolvedWatchPath;
      void createDesktopWatchPayload(eventType, resolvedPath).then((payload) => {
        if (!safeSend(sender, `desktop:fs:watch:${watchId}`, payload)) {
          listener.close();
          activeWatchers.delete(watchId);
        }
      });
    });

    listener.on('error', () => {
      listener.close();
      activeWatchers.delete(watchId);
    });

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
