const TABLE_INTERNAL_CONTEXT_MENU_TARGET =
  '[data-role="x-line-drag-handle"], [data-role="y-line-drag-handle"], [data-role="bottom-edge-create-zone"], [data-role="right-edge-create-zone"], [data-role="corner-edge-create-zone"], [data-role="col-header-drag-control"], [data-role="col-header-drag-menu"]';

export function shouldIgnoreTableContextMenuTarget(
  target: EventTarget | null
): boolean {
  return (
    target instanceof Element &&
    target.closest(TABLE_INTERNAL_CONTEXT_MENU_TARGET) != null
  );
}
