export function resolveOrderedListPreviewLabel(target: HTMLElement, targetIndex: number): string {
  const listItem = target.closest('li');
  if (!(listItem instanceof HTMLLIElement)) {
    return `${targetIndex + 1}.`;
  }

  const list = listItem.parentElement;
  if (!(list instanceof HTMLOListElement || list instanceof HTMLUListElement)) {
    return `${targetIndex + 1}.`;
  }

  const listItems = Array.from(list.children).filter((child): child is HTMLLIElement => child instanceof HTMLLIElement);
  const itemIndex = listItems.indexOf(listItem);
  if (itemIndex < 0) {
    return `${targetIndex + 1}.`;
  }

  const start = list instanceof HTMLOListElement
    ? Number.parseInt(list.getAttribute('start') ?? '', 10)
    : Number.NaN;
  const resolvedStart = Number.isFinite(start) ? start : 1;

  return `${resolvedStart + itemIndex}.`;
}
