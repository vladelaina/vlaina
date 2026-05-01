export interface SidebarMenuPosition {
  top: number;
  left: number;
}

export const VIEWPORT_MENU_MARGIN = 8;
export const SUBMENU_GAP = 4;
export const SIDEBAR_SCROLL_ROOT_SELECTOR =
  '[data-sidebar-scroll-root="true"], [data-notes-sidebar-scroll-root="true"]';
export const MENU_LAYER_SELECTOR =
  '[data-sidebar-context-menu-layer="true"], [data-notes-sidebar-context-menu-layer="true"]';
export const MENU_PANEL_CLASS_NAME =
  'min-w-[180px] overflow-y-auto rounded-2xl border border-[var(--notes-sidebar-menu-border)] bg-[var(--notes-sidebar-menu-bg)] p-1.5 shadow-[var(--notes-sidebar-menu-shadow)]';

export function clampToViewport(
  position: SidebarMenuPosition,
  width: number,
  height: number,
): SidebarMenuPosition {
  const maxTop = Math.max(VIEWPORT_MENU_MARGIN, window.innerHeight - height - VIEWPORT_MENU_MARGIN);
  const maxLeft = Math.max(VIEWPORT_MENU_MARGIN, window.innerWidth - width - VIEWPORT_MENU_MARGIN);

  return {
    top: Math.min(Math.max(position.top, VIEWPORT_MENU_MARGIN), maxTop),
    left: Math.min(Math.max(position.left, VIEWPORT_MENU_MARGIN), maxLeft),
  };
}

export function resolveMenuPosition(
  menuElement: HTMLDivElement,
  position: SidebarMenuPosition,
): SidebarMenuPosition {
  return clampToViewport(position, menuElement.offsetWidth, menuElement.offsetHeight);
}

export function isInsideMenuLayer(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(MENU_LAYER_SELECTOR));
}

export function resolveSubmenuLayout(triggerRect: DOMRect, submenuElement: HTMLDivElement) {
  const submenuWidth = submenuElement.offsetWidth;
  const submenuHeight = submenuElement.offsetHeight;
  const availableRight = window.innerWidth - triggerRect.right - SUBMENU_GAP - VIEWPORT_MENU_MARGIN;
  const availableLeft = triggerRect.left - SUBMENU_GAP - VIEWPORT_MENU_MARGIN;
  const openLeft = availableRight < submenuWidth && availableLeft > availableRight;
  const rawLeft = openLeft
    ? triggerRect.left - SUBMENU_GAP - submenuWidth
    : triggerRect.right + SUBMENU_GAP;

  return {
    openLeft,
    position: clampToViewport(
      { top: triggerRect.top, left: rawLeft },
      submenuWidth,
      submenuHeight,
    ),
  };
}
