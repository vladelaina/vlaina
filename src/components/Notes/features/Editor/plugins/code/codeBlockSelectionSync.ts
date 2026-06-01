type SelectionSyncCallback = () => void;

export const CODE_BLOCK_SELECTION_SYNC_EVENT = 'editor:code-block-selection-sync';

interface SelectionSyncRegistry {
  callbacks: Set<SelectionSyncCallback>;
  frameId: number | null;
  selectionListener: () => void;
  syncListener: () => void;
}

const registries = new WeakMap<Document, SelectionSyncRegistry>();

function getRegistry(doc: Document): SelectionSyncRegistry {
  const existing = registries.get(doc);
  if (existing) {
    return existing;
  }

  const runCallbacks = () => {
    registry.frameId = null;
    registry.callbacks.forEach((callback) => callback());
  };

  const scheduleCallbacks = () => {
    const win = doc.defaultView;

    if (!win) {
      runCallbacks();
      return;
    }

    if (registry.frameId !== null) {
      win.cancelAnimationFrame(registry.frameId);
    }

    registry.frameId = win.requestAnimationFrame(runCallbacks);
  };

  const registry: SelectionSyncRegistry = {
    callbacks: new Set(),
    frameId: null,
    selectionListener: scheduleCallbacks,
    syncListener: scheduleCallbacks,
  };

  registries.set(doc, registry);
  doc.addEventListener('selectionchange', registry.selectionListener);
  doc.addEventListener(CODE_BLOCK_SELECTION_SYNC_EVENT, registry.syncListener);
  return registry;
}

export function requestCodeBlockSelectionSync(doc: Document | null): void {
  doc?.dispatchEvent(new Event(CODE_BLOCK_SELECTION_SYNC_EVENT));
}

export function subscribeCodeBlockSelectionSync(
  doc: Document | null,
  callback: SelectionSyncCallback,
): () => void {
  if (!doc) {
    return () => {};
  }

  const registry = getRegistry(doc);
  registry.callbacks.add(callback);

  return () => {
    registry.callbacks.delete(callback);
    if (registry.callbacks.size > 0) {
      return;
    }

    doc.removeEventListener('selectionchange', registry.selectionListener);
    doc.removeEventListener(CODE_BLOCK_SELECTION_SYNC_EVENT, registry.syncListener);
    const win = doc.defaultView;
    if (win && registry.frameId !== null) {
      win.cancelAnimationFrame(registry.frameId);
    }
    registry.frameId = null;
    registries.delete(doc);
  };
}
