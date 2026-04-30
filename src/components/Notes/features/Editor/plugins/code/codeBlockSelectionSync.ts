type SelectionSyncCallback = () => void;

interface SelectionSyncRegistry {
  callbacks: Set<SelectionSyncCallback>;
  frameId: number | null;
  listener: () => void;
}

const registries = new WeakMap<Document, SelectionSyncRegistry>();

function getRegistry(doc: Document): SelectionSyncRegistry {
  const existing = registries.get(doc);
  if (existing) {
    return existing;
  }

  const registry: SelectionSyncRegistry = {
    callbacks: new Set(),
    frameId: null,
    listener: () => {
      const win = doc.defaultView;
      const runCallbacks = () => {
        registry.frameId = null;
        registry.callbacks.forEach((callback) => callback());
      };

      if (!win) {
        runCallbacks();
        return;
      }

      if (registry.frameId !== null) {
        win.cancelAnimationFrame(registry.frameId);
      }

      registry.frameId = win.requestAnimationFrame(runCallbacks);
    },
  };

  registries.set(doc, registry);
  doc.addEventListener('selectionchange', registry.listener);
  return registry;
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

    doc.removeEventListener('selectionchange', registry.listener);
    const win = doc.defaultView;
    if (win && registry.frameId !== null) {
      win.cancelAnimationFrame(registry.frameId);
    }
    registry.frameId = null;
    registries.delete(doc);
  };
}
