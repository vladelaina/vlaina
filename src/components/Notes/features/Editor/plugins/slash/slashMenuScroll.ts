export function keepSlashMenuSelectedItemVisible(menuElement: HTMLElement): void {
  const selectedItem = menuElement.querySelector<HTMLElement>('.slash-menu-item.selected');
  if (!selectedItem) return;

  const itemTop = selectedItem.offsetTop;
  const itemBottom = itemTop + selectedItem.offsetHeight;
  const viewTop = menuElement.scrollTop;
  const viewBottom = viewTop + menuElement.clientHeight;

  if (itemTop < viewTop) {
    menuElement.scrollTop = itemTop;
    return;
  }

  if (itemBottom > viewBottom) {
    menuElement.scrollTop = itemBottom - menuElement.clientHeight;
  }
}
