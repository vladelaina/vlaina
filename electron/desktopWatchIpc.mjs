import { watch } from 'node:fs';
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

export function registerDesktopWatchIpc({
  handleIpc,
  requireNonEmptyString,
  assertAuthorizedFsWatchPath,
}) {
  handleIpc('desktop:fs:watch', async (event, watchPath) => {
    const resolvedWatchPath = await assertAuthorizedFsWatchPath(watchPath);
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
        if (!safeSend(sender, `desktop:fs:watch:${watchId}`, payload)) {
          listener.close();
          activeWatchers.delete(watchId);
        }
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
