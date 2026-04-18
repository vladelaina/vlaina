import { useSyncExternalStore } from 'react';

interface ExternalFileTreeDropSnapshot {
  active: boolean;
  dropTargetPath: string | null;
}

let snapshot: ExternalFileTreeDropSnapshot = {
  active: false,
  dropTargetPath: null,
};

const listeners = new Set<() => void>();

function emitSnapshot() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(nextSnapshot: ExternalFileTreeDropSnapshot) {
  if (
    snapshot.active === nextSnapshot.active &&
    snapshot.dropTargetPath === nextSnapshot.dropTargetPath
  ) {
    return;
  }

  snapshot = nextSnapshot;
  emitSnapshot();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

export function setExternalFileTreeDropTarget(dropTargetPath: string | null) {
  setSnapshot({
    active: true,
    dropTargetPath,
  });
}

export function clearExternalFileTreeDropTarget() {
  setSnapshot({
    active: false,
    dropTargetPath: null,
  });
}

export function useExternalFileTreeDropState<T>(
  selector: (state: ExternalFileTreeDropSnapshot) => T,
) {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(getSnapshot()),
  );
}
