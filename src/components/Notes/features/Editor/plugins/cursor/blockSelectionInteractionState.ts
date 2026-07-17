const pendingBlockSelectionRoots = new WeakSet<HTMLElement>();

export function setBlockSelectionInteractionPending(root: HTMLElement, pending: boolean): void {
  if (pending) {
    pendingBlockSelectionRoots.add(root);
    return;
  }
  pendingBlockSelectionRoots.delete(root);
}

export function isBlockSelectionInteractionPending(root: HTMLElement): boolean {
  return pendingBlockSelectionRoots.has(root);
}
