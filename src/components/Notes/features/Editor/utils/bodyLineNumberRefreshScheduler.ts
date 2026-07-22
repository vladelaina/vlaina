import { MAX_BODY_LINE_NUMBER_PRECISE_TEXT_ANCHOR_TARGETS } from './bodyLineNumberLayout';

const LARGE_BODY_LINE_NUMBER_REFRESH_INTERVAL_MS = 200;

export function createBodyLineNumberRefreshScheduler(onRefresh: () => void) {
  let lastCompletedAt = Number.NEGATIVE_INFINITY;
  let timerId: number | null = null;

  return {
    cancel() {
      if (timerId === null) return;
      window.clearTimeout(timerId);
      timerId = null;
    },
    markCompleted() {
      lastCompletedAt = performance.now();
    },
    request(targetCount: number) {
      const remainingDelay = lastCompletedAt
        + LARGE_BODY_LINE_NUMBER_REFRESH_INTERVAL_MS
        - performance.now();
      if (
        targetCount <= MAX_BODY_LINE_NUMBER_PRECISE_TEXT_ANCHOR_TARGETS
        || remainingDelay <= 0
      ) {
        onRefresh();
        return;
      }

      if (timerId !== null) return;
      timerId = window.setTimeout(() => {
        timerId = null;
        onRefresh();
      }, remainingDelay);
    },
  };
}
