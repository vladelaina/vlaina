export interface SelectionInsertEventHandlers {
  handleForceReset: () => void;
  handleMouseDown: (event: MouseEvent) => void;
  handleMouseMove: (event: MouseEvent) => void;
  handleMouseUp: () => void;
  handleSelectStart: (event: Event) => void;
  handleSelectionChange: () => void;
  handleVisibilityChange: () => void;
  handleWindowBlur: () => void;
  scheduleSyncState: () => void;
}

export function addSelectionInsertEventListeners({
  handleForceReset,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleSelectStart,
  handleSelectionChange,
  handleVisibilityChange,
  handleWindowBlur,
  scheduleSyncState,
}: SelectionInsertEventHandlers): () => void {
  window.addEventListener("mousedown", handleMouseDown, true);
  window.addEventListener("mousemove", handleMouseMove, true);
  window.addEventListener("mouseup", handleMouseUp, true);
  document.addEventListener("selectstart", handleSelectStart, true);
  document.addEventListener("selectionchange", handleSelectionChange);
  window.addEventListener("mouseup", scheduleSyncState);
  window.addEventListener("keyup", scheduleSyncState);
  window.addEventListener("resize", scheduleSyncState);
  window.addEventListener("scroll", scheduleSyncState, true);
  window.addEventListener("blur", handleWindowBlur);
  window.addEventListener("pagehide", handleForceReset);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    window.removeEventListener("mousedown", handleMouseDown, true);
    window.removeEventListener("mousemove", handleMouseMove, true);
    window.removeEventListener("mouseup", handleMouseUp, true);
    document.removeEventListener("selectstart", handleSelectStart, true);
    document.removeEventListener("selectionchange", handleSelectionChange);
    window.removeEventListener("mouseup", scheduleSyncState);
    window.removeEventListener("keyup", scheduleSyncState);
    window.removeEventListener("resize", scheduleSyncState);
    window.removeEventListener("scroll", scheduleSyncState, true);
    window.removeEventListener("blur", handleWindowBlur);
    window.removeEventListener("pagehide", handleForceReset);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}
