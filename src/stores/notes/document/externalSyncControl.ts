type Listener = () => void;

let pauseDepth = 0;
let activeWatcherCount = 0;

const listeners = new Set<Listener>();
const idleWaiters = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
  if (activeWatcherCount === 0) {
    idleWaiters.forEach((resolve) => resolve());
    idleWaiters.clear();
  }
}

export function subscribeExternalSyncPause(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isExternalSyncPaused() {
  return pauseDepth > 0;
}

export function registerExternalSyncWatcher() {
  activeWatcherCount += 1;
  emitChange();

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    activeWatcherCount = Math.max(0, activeWatcherCount - 1);
    emitChange();
  };
}

export async function suspendExternalSync() {
  pauseDepth += 1;
  emitChange();

  if (activeWatcherCount > 0) {
    await new Promise<void>((resolve) => {
      idleWaiters.add(resolve);
    });
  }

  let resumed = false;

  return () => {
    if (resumed) {
      return;
    }

    resumed = true;
    pauseDepth = Math.max(0, pauseDepth - 1);
    emitChange();
  };
}
