import type { RefObject } from 'react';

const INITIAL_SCROLL_RATIO = 0.22;
const MIN_INITIAL_SCROLL_PX = 96;
const MAX_INITIAL_SCROLL_PX = 196;

export const CONTINUOUS_SCROLL_SPEED = 0.2;
export const HOLD_SCROLL_DELAY_MS = 110;
export const SCROLL_EASING_MS = 125;
export const VELOCITY_RESPONSE_MS = 110;

export type PageScrollKey = 'PageUp' | 'PageDown';

export interface HeldPageScrollState {
  activeKey: PageScrollKey | null;
  direction: -1 | 0 | 1;
  continuousActive: boolean;
  isHovering: boolean;
  currentVelocity: number;
  holdTimerId: number | null;
  rafId: number | null;
  lastTimestamp: number | null;
  targetScrollTop: number | null;
}

export interface UseHeldPageScrollOptions {
  enabled?: boolean;
  scopeRef?: RefObject<HTMLElement | null>;
  ignoreEditableTargets?: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getInitialScrollDelta(container: HTMLDivElement) {
  return clamp(
    container.clientHeight * INITIAL_SCROLL_RATIO,
    MIN_INITIAL_SCROLL_PX,
    MAX_INITIAL_SCROLL_PX,
  );
}

export function clampTargetScrollTop(container: HTMLDivElement, value: number) {
  const maxScrollTop = Math.max(container.scrollHeight - container.clientHeight, 0);
  return clamp(value, 0, maxScrollTop);
}

export function isEventWithinRoot(root: HTMLElement, target: EventTarget | null) {
  if (!(target instanceof Node)) {
    return false;
  }

  return root.contains(target);
}
