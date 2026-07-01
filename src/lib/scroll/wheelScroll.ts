import type { WheelEvent as ReactWheelEvent } from 'react';

const WHEEL_DELTA_MODE_LINE = 1;
const WHEEL_DELTA_MODE_PAGE = 2;
const WHEEL_LINE_HEIGHT_PX = 16;
const SCROLL_EPSILON_PX = 1;
const SCROLLABLE_OVERFLOW_VALUES = new Set(['auto', 'scroll', 'overlay']);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeWheelDelta(delta: number, deltaMode: number, pageSize: number) {
  if (deltaMode === WHEEL_DELTA_MODE_LINE) {
    return delta * WHEEL_LINE_HEIGHT_PX;
  }

  if (deltaMode === WHEEL_DELTA_MODE_PAGE) {
    return delta * pageSize;
  }

  return delta;
}

function getElementFromTarget(target: EventTarget | null) {
  if (target instanceof Element) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}

function canElementScrollVertically(element: HTMLElement) {
  const overflowY = window.getComputedStyle(element).overflowY;
  return (
    SCROLLABLE_OVERFLOW_VALUES.has(overflowY) &&
    element.scrollHeight - element.clientHeight > SCROLL_EPSILON_PX
  );
}

function canElementConsumeVerticalDelta(element: HTMLElement, deltaY: number) {
  const maxScrollTop = Math.max(element.scrollHeight - element.clientHeight, 0);

  if (deltaY < 0) {
    return element.scrollTop > SCROLL_EPSILON_PX;
  }

  if (deltaY > 0) {
    return element.scrollTop < maxScrollTop - SCROLL_EPSILON_PX;
  }

  return false;
}

function hasNestedScrollableConsumer(target: EventTarget | null, root: HTMLElement, deltaY: number) {
  let element = getElementFromTarget(target);

  while (element && element !== root) {
    if (
      element instanceof HTMLElement &&
      canElementScrollVertically(element) &&
      canElementConsumeVerticalDelta(element, deltaY)
    ) {
      return true;
    }

    element = element.parentElement;
  }

  return false;
}

export function handleScrollableWheel(event: ReactWheelEvent<HTMLElement>) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.deltaY === 0) {
    return;
  }

  const scrollRoot = event.currentTarget;
  const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, scrollRoot.clientHeight);
  if (deltaY === 0 || hasNestedScrollableConsumer(event.target, scrollRoot, deltaY)) {
    return;
  }

  const maxScrollTop = Math.max(scrollRoot.scrollHeight - scrollRoot.clientHeight, 0);
  if (maxScrollTop <= 0) {
    return;
  }

  const nextScrollTop = clamp(scrollRoot.scrollTop + deltaY, 0, maxScrollTop);
  if (Math.abs(nextScrollTop - scrollRoot.scrollTop) < SCROLL_EPSILON_PX) {
    return;
  }

  event.preventDefault();
  scrollRoot.scrollTop = nextScrollTop;
}
