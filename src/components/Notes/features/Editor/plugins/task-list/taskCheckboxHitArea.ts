const DEFAULT_CHECKBOX_SIZE = 16;
const DEFAULT_CLICK_PADDING = 6;

export interface CheckboxBoundsInput {
  textLeft: number;
  gap: number;
  checkboxSize?: number;
}

export function calculateTaskCheckboxBounds({
  textLeft,
  gap,
  checkboxSize = DEFAULT_CHECKBOX_SIZE,
}: CheckboxBoundsInput) {
  const right = textLeft - gap;
  const left = right - checkboxSize;

  return { left, right };
}

export function getTaskCheckboxBounds(taskItem: HTMLElement) {
  const itemRect = taskItem.getBoundingClientRect();
  const textBlock = taskItem.querySelector(':scope > [data-text-align], :scope > p') as HTMLElement | null;

  if (!textBlock) {
    return { left: itemRect.left - 30, right: itemRect.left + 5 };
  }

  const textRect = textBlock.getBoundingClientRect();
  if (!Number.isFinite(textRect.left)) {
    return { left: itemRect.left - 30, right: itemRect.left + 5 };
  }

  const itemStyle = window.getComputedStyle(taskItem);
  const beforeStyle = window.getComputedStyle(taskItem, '::before');
  const gap = Number.parseFloat(itemStyle.columnGap || itemStyle.gap || '8') || 8;
  const checkboxSize = Number.parseFloat(beforeStyle.width || '') || DEFAULT_CHECKBOX_SIZE;

  return calculateTaskCheckboxBounds({
    textLeft: textRect.left,
    gap,
    checkboxSize,
  });
}

export function isTaskCheckboxClick(taskItem: HTMLElement, clientX: number) {
  const { left, right } = getTaskCheckboxBounds(taskItem);
  return clientX >= left - DEFAULT_CLICK_PADDING && clientX <= right + DEFAULT_CLICK_PADDING;
}
