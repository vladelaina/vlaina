export interface SidebarMenuPosition {
  top: number;
  left: number;
}

const SIDEBAR_MENU_OFFSET_X = 4;
const SIDEBAR_CONTEXT_MENU_OVERLAP_X = 56;

export function getSidebarMenuPositionFromTriggerRect(rect: DOMRect): SidebarMenuPosition {
  return {
    top: rect.top,
    left: rect.right + SIDEBAR_MENU_OFFSET_X,
  };
}

export function getSidebarContextMenuPosition(
  rect: DOMRect,
  clientY: number,
): SidebarMenuPosition {
  return {
    top: clientY,
    left: rect.right - SIDEBAR_CONTEXT_MENU_OVERLAP_X,
  };
}
