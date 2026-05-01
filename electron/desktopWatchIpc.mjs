import { watch } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const activeWatchers = new Map();
const watcherGroups = new Map();
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

function normalizeDesktopWatchOptions(options) {
  return { recursive: options?.recursive !== false };
}

function getWatcherGroupKey(watchPath, options) {
  return JSON.stringify([watchPath, options.recursive]);
}

function isPathCoveredByWatchPath(watchPath, watchedPath, recursive) {
  if (watchedPath === watchPath) {
    return true;
  }

  if (recursive) {
    return watchedPath.startsWith(`${watchPath}${path.sep}`);
  }

  return path.dirname(watchedPath) === watchPath;
}

function closeWatcherGroup(groupKey) {
  const group = watcherGroups.get(groupKey);
  if (!group) {
    return;
  }

  group.listener.close();
  watcherGroups.delete(groupKey);
  for (const watchId of group.subscribers.keys()) {
    activeWatchers.delete(watchId);
  }
}

function sendWatchPayloadToSubscribers(group, payload) {
  for (const [watchId, sender] of group.subscribers) {
    if (!safeSend(sender, `desktop:fs:watch:${watchId}`, payload)) {
      group.subscribers.delete(watchId);
      activeWatchers.delete(watchId);
    }
  }
}

function createWatcherGroup(groupKey, resolvedWatchPath, options) {
  const group = {
    listener: null,
    resolvedWatchPath,
    options,
    subscribers: new Map(),
  };

  let listener;

  try {
    listener = watch(
      resolvedWatchPath,
      { recursive: options.recursive },
      (eventType, filename) => {
        const resolvedPath = filename ? path.join(resolvedWatchPath, filename.toString()) : resolvedWatchPath;
        void createDesktopWatchPayload(eventType, resolvedPath).then((payload) => {
          sendWatchPayloadToSubscribers(group, payload);
          if (group.subscribers.size === 0) {
            closeWatcherGroup(groupKey);
          }
        });
      },
    );
  } catch (error) {
    throw new Error(`Failed to start filesystem watch for ${resolvedWatchPath}: ${getWatchErrorMessage(error)}`);
  }

  listener.on('error', (error) => {
    console.warn(
      `[desktopWatchIpc] filesystem watch failed for ${resolvedWatchPath}: ${getWatchErrorMessage(error)}`,
    );
    closeWatcherGroup(groupKey);
  });

  group.listener = listener;
  watcherGroups.set(groupKey, group);
  return group;
}

export function notifyDesktopWatchRename(oldPath, newPath) {
  const payload = {
    type: { modify: { kind: 'rename', mode: 'both' } },
    paths: [oldPath, newPath],
  };

  for (const [groupKey, group] of watcherGroups) {
    const coversRename =
      isPathCoveredByWatchPath(group.resolvedWatchPath, oldPath, group.options.recursive) ||
      isPathCoveredByWatchPath(group.resolvedWatchPath, newPath, group.options.recursive);

    if (!coversRename) {
      continue;
    }

    sendWatchPayloadToSubscribers(group, payload);
    if (group.subscribers.size === 0) {
      closeWatcherGroup(groupKey);
    }
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
  handleIpc('desktop:fs:watch', async (event, watchPath, options) => {
    const resolvedWatchPath = await assertAuthorizedFsWatchPath(watchPath);
    const watchOptions = normalizeDesktopWatchOptions(options);
    const groupKey = getWatcherGroupKey(resolvedWatchPath, watchOptions);
    const watchId = `watch-${++watcherCounter}`;
    const group = watcherGroups.get(groupKey) ?? createWatcherGroup(
      groupKey,
      resolvedWatchPath,
      watchOptions
    );

    group.subscribers.set(watchId, event.sender);
    activeWatchers.set(watchId, groupKey);
    return watchId;
  });

  handleIpc('desktop:fs:unwatch', (_event, watchId) => {
    const normalizedWatchId = requireNonEmptyString(watchId, 'watch id');
    const groupKey = activeWatchers.get(normalizedWatchId);
    if (!groupKey) {
      return;
    }

    const group = watcherGroups.get(groupKey);
    activeWatchers.delete(normalizedWatchId);
    group?.subscribers.delete(normalizedWatchId);
    if (group && group.subscribers.size === 0) {
      closeWatcherGroup(groupKey);
    }
  });
}

function getWatchErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export { isPathCoveredByWatchPath, normalizeDesktopWatchOptions };
