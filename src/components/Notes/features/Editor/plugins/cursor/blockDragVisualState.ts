export const BLOCK_DRAGGING_CURSOR_CLASS = 'vlaina-block-dragging-cursor';
export const BLOCK_DRAGGING_ACTIVE_CLASS = 'vlaina-block-drag-active';

type BlockDragVisualSnapshot = {
  selectionDragging: boolean;
  blockDragging: boolean;
};

type Listener = () => void;

let snapshot: BlockDragVisualSnapshot = {
  selectionDragging: false,
  blockDragging: false,
};

const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

function syncBodyClasses() {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle(BLOCK_DRAGGING_CURSOR_CLASS, snapshot.selectionDragging);
  document.body.classList.toggle(BLOCK_DRAGGING_ACTIVE_CLASS, snapshot.blockDragging);
}

function updateSnapshot(next: Partial<BlockDragVisualSnapshot>) {
  const resolved: BlockDragVisualSnapshot = {
    ...snapshot,
    ...next,
  };

  if (
    resolved.selectionDragging === snapshot.selectionDragging
    && resolved.blockDragging === snapshot.blockDragging
  ) {
    return;
  }

  snapshot = resolved;
  syncBodyClasses();
  emit();
}

export function setSelectionDraggingVisualState(active: boolean) {
  updateSnapshot({ selectionDragging: active });
}

export function setBlockDraggingVisualState(active: boolean) {
  updateSnapshot({ blockDragging: active });
}

export function resetBlockDragVisualState() {
  updateSnapshot({
    selectionDragging: false,
    blockDragging: false,
  });
}

export function subscribeBlockDragVisualState(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBlockDragVisualSnapshot() {
  return snapshot.selectionDragging || snapshot.blockDragging;
}
