import { useSyncExternalStore } from 'react';

interface ExternalFileTreeDropSnapshot {
  active: boolean;
  dropTargetPath: string | null;
  dropTargetKind: 'folder' | 'starred' | null;
}

let snapshot: ExternalFileTreeDropSnapshot = {
  active: false,
  dropTargetPath: null,
  dropTargetKind: null,
};

const listeners = new Set<() => void>();

function emitSnapshot() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(nextSnapshot: ExternalFileTreeDropSnapshot) {
  if (
    snapshot.active === nextSnapshot.active &&
    snapshot.dropTargetPath === nextSnapshot.dropTargetPath &&
    snapshot.dropTargetKind === nextSnapshot.dropTargetKind
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

export function setExternalFileTreeDropTarget(
  dropTargetPath: string | null,
  dropTargetKind: 'folder' | 'starred' | null = dropTargetPath == null ? null : 'folder',
) {
  setSnapshot({
    active: true,
    dropTargetPath,
    dropTargetKind,
  });
}

export function clearExternalFileTreeDropTarget() {
  setSnapshot({
    active: false,
    dropTargetPath: null,
    dropTargetKind: null,
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
