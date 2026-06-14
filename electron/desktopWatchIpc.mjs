import { watch } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const activeWatchers = new Map();
const watcherGroups = new Map();
let watcherCounter = 0;
export const MAX_DESKTOP_ACTIVE_WATCHERS = 256;
export const MAX_DESKTOP_WATCH_GROUPS = 64;
export const MAX_DESKTOP_WATCH_GROUP_SUBSCRIBERS = 64;
const MAX_DESKTOP_WATCH_PATH_CHARS = 8192;
const UNSAFE_DESKTOP_WATCH_PATH_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

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

function normalizeWatchComparisonPath(value) {
  const normalized = value.replace(/\\/g, '/');
  if (normalized === '/') {
    return normalized;
  }
  return normalized.replace(/\/+$/, '');
}

function getWatchComparisonParentPath(value) {
  const normalized = normalizeWatchComparisonPath(value);
  const index = normalized.lastIndexOf('/');
  if (index <= 0) {
    return '';
  }
  return normalized.slice(0, index);
}

function isPathCoveredByWatchPath(watchPath, watchedPath, recursive) {
  const normalizedWatchPath = normalizeWatchComparisonPath(watchPath);
  const normalizedWatchedPath = normalizeWatchComparisonPath(watchedPath);

  if (normalizedWatchedPath === normalizedWatchPath) {
    return true;
  }

  if (recursive) {
    if (normalizedWatchPath === '/') {
      return normalizedWatchedPath.startsWith('/');
    }
    return normalizedWatchedPath.startsWith(`${normalizedWatchPath}/`);
  }

  return getWatchComparisonParentPath(normalizedWatchedPath) === normalizedWatchPath;
}

function normalizeDesktopWatchPayloadPath(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_DESKTOP_WATCH_PATH_CHARS ||
    UNSAFE_DESKTOP_WATCH_PATH_PATTERN.test(value)
  ) {
    return null;
  }

  return value;
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
        const resolvedPath = normalizeDesktopWatchPayloadPath(
          filename ? path.join(resolvedWatchPath, filename.toString()) : resolvedWatchPath
        );
        if (!resolvedPath) {
          return;
        }
        void createDesktopWatchPayload(eventType, resolvedPath).then((payload) => {
          if (!payload) {
            return;
          }
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
    closeWatcherGroup(groupKey);
  });

  group.listener = listener;
  watcherGroups.set(groupKey, group);
  return group;
}

export function notifyDesktopWatchRename(oldPath, newPath) {
  const safeOldPath = normalizeDesktopWatchPayloadPath(oldPath);
  const safeNewPath = normalizeDesktopWatchPayloadPath(newPath);
  if (!safeOldPath || !safeNewPath) {
    return;
  }

  const payload = {
    type: { modify: { kind: 'rename', mode: 'both' } },
    paths: [safeOldPath, safeNewPath],
  };

  for (const [groupKey, group] of watcherGroups) {
    const coversRename =
      isPathCoveredByWatchPath(group.resolvedWatchPath, safeOldPath, group.options.recursive) ||
      isPathCoveredByWatchPath(group.resolvedWatchPath, safeNewPath, group.options.recursive);

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
  const safePath = normalizeDesktopWatchPayloadPath(resolvedPath);
  if (!safePath) {
    return null;
  }

  if (eventType !== 'rename') {
    return {
      type: { modify: { kind: 'data', mode: 'any' } },
      paths: [safePath],
    };
  }

  try {
    const info = await statPath(safePath);
    return {
      type: { create: { kind: info.isDirectory() ? 'folder' : 'file' } },
      paths: [safePath],
    };
  } catch {
    return {
      type: { remove: { kind: 'any' } },
      paths: [safePath],
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
    if (activeWatchers.size >= MAX_DESKTOP_ACTIVE_WATCHERS) {
      throw new Error('Too many active desktop filesystem watchers.');
    }
    if (!watcherGroups.has(groupKey) && watcherGroups.size >= MAX_DESKTOP_WATCH_GROUPS) {
      throw new Error('Too many active desktop filesystem watcher groups.');
    }
    const watchId = `watch-${++watcherCounter}`;
    const group = watcherGroups.get(groupKey) ?? createWatcherGroup(
      groupKey,
      resolvedWatchPath,
      watchOptions
    );
    if (group.subscribers.size >= MAX_DESKTOP_WATCH_GROUP_SUBSCRIBERS) {
      throw new Error('Too many desktop filesystem watcher subscribers.');
    }

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
