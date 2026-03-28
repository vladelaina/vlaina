export interface SidebarMenuPosition {
  top: number;
  left: number;
}

export function getSidebarMenuPositionFromTriggerRect(rect: DOMRect): SidebarMenuPosition {
  return {
    top: rect.top,
    left: rect.right + 4,
  };
}
