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

function canElementScrollHorizontally(element: HTMLElement) {
  const overflowX = window.getComputedStyle(element).overflowX;
  return (
    SCROLLABLE_OVERFLOW_VALUES.has(overflowX) &&
    element.scrollWidth - element.clientWidth > SCROLL_EPSILON_PX
  );
}

function canElementConsumeHorizontalDelta(element: HTMLElement, deltaX: number) {
  const maxScrollLeft = Math.max(element.scrollWidth - element.clientWidth, 0);

  if (deltaX < 0) {
    return element.scrollLeft > SCROLL_EPSILON_PX;
  }

  if (deltaX > 0) {
    return element.scrollLeft < maxScrollLeft - SCROLL_EPSILON_PX;
  }

  return false;
}

function hasNestedScrollableConsumer(
  target: EventTarget | null,
  root: HTMLElement,
  deltaX: number,
) {
  let element = getElementFromTarget(target);

  while (element && element !== root) {
    if (
      element instanceof HTMLElement &&
      canElementScrollHorizontally(element) &&
      canElementConsumeHorizontalDelta(element, deltaX)
    ) {
      return true;
    }

    element = element.parentElement;
  }

  return false;
}

function hasNestedScrollableVerticalConsumer(
  target: EventTarget | null,
  root: HTMLElement,
  deltaY: number,
) {
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

function scrollElementHorizontally(scrollRoot: HTMLElement, deltaX: number) {
  const maxScrollLeft = Math.max(scrollRoot.scrollWidth - scrollRoot.clientWidth, 0);
  if (maxScrollLeft <= 0) {
    return false;
  }

  const nextScrollLeft = clamp(scrollRoot.scrollLeft + deltaX, 0, maxScrollLeft);
  if (Math.abs(nextScrollLeft - scrollRoot.scrollLeft) < SCROLL_EPSILON_PX) {
    return false;
  }

  scrollRoot.scrollLeft = nextScrollLeft;
  return true;
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

function scheduleVerticalNativeScrollFallback(
  scrollRoot: HTMLElement,
  deltaY: number,
) {
  const beforeScrollTop = scrollRoot.scrollTop;
  if (!canElementConsumeVerticalDelta(scrollRoot, deltaY)) {
    return;
  }

  const checkNativeScroll = () => {
    const nativeScrollTop = scrollRoot.scrollTop;
    if (Math.abs(nativeScrollTop - beforeScrollTop) > SCROLL_EPSILON_PX) {
      return;
    }

    const maxScrollTop = Math.max(scrollRoot.scrollHeight - scrollRoot.clientHeight, 0);
    const nextScrollTop = clamp(beforeScrollTop + deltaY, 0, maxScrollTop);
    if (Math.abs(nextScrollTop - beforeScrollTop) < SCROLL_EPSILON_PX) {
      return;
    }

    scrollRoot.scrollTop = nextScrollTop;
  };

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(checkNativeScroll);
    return;
  }

  window.setTimeout(checkNativeScroll, 0);
}

export function handleScrollableWheel(event: ReactWheelEvent<HTMLElement>) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey) {
    return;
  }

  const scrollRoot = event.currentTarget;
  const canScrollVertically = canElementScrollVertically(scrollRoot);

  if (event.deltaY !== 0 && canScrollVertically) {
    const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, scrollRoot.clientHeight);
    if (!hasNestedScrollableVerticalConsumer(event.target, scrollRoot, deltaY)) {
      scheduleVerticalNativeScrollFallback(scrollRoot, deltaY);
    }
    return;
  }

  const rawDeltaX = event.deltaX !== 0
    ? event.deltaX
    : !canScrollVertically
      ? event.deltaY
      : 0;
  const deltaX = normalizeWheelDelta(rawDeltaX, event.deltaMode, scrollRoot.clientWidth);
  if (
    deltaX === 0 ||
    hasNestedScrollableConsumer(event.target, scrollRoot, deltaX) ||
    !scrollElementHorizontally(scrollRoot, deltaX)
  ) {
    return;
  }

  event.preventDefault();
}
