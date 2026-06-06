export const MAX_FLOATING_TOOLBAR_SUBMENU_SCAN_ELEMENTS = 512;

export function collectToolbarSubmenus(
  toolbar: HTMLElement,
  maxScanned = MAX_FLOATING_TOOLBAR_SUBMENU_SCAN_ELEMENTS
): HTMLElement[] {
  const submenus: HTMLElement[] = [];
  const walker = toolbar.ownerDocument.createTreeWalker(toolbar, 1);
  let scanned = 0;
  let node = walker.nextNode();

  while (node) {
    if (node instanceof HTMLElement) {
      scanned += 1;
      if (scanned > maxScanned) break;
      if (node.classList.contains('toolbar-submenu')) {
        submenus.push(node);
      }
    }
    node = walker.nextNode();
  }

  return submenus;
}

export function correctToolbarSubmenusToContentBounds(
  toolbar: HTMLElement,
  bounds: { left: number; right: number }
): void {
  const visibleSubmenus = collectToolbarSubmenus(toolbar).filter((submenu) => submenu.offsetParent !== null);

  for (const submenu of visibleSubmenus) {
    submenu.style.removeProperty('--vlaina-toolbar-submenu-shift-x');

    const submenuRect = submenu.getBoundingClientRect();
    let shiftX = 0;

    if (submenuRect.left < bounds.left) {
      shiftX += bounds.left - submenuRect.left;
    }

    if (submenuRect.right > bounds.right) {
      shiftX -= submenuRect.right - bounds.right;
    }

    if (shiftX !== 0) {
      submenu.style.setProperty('--vlaina-toolbar-submenu-shift-x', `${shiftX}px`);
    }
  }
}
