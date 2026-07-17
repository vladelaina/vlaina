import type { BodyLineNumberLabel } from './bodyLineNumberLayout';

export const MAX_RENDERED_BODY_LINE_NUMBERS = 320;
const BODY_LINE_NUMBER_WINDOW_BUFFER = 80;

export interface BodyLineNumberWindow {
  start: number;
  end: number;
}

function findFirstLabelAtOrAfter(labels: readonly BodyLineNumberLabel[], top: number): number {
  let low = 0;
  let high = labels.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((labels[middle]?.top ?? Number.POSITIVE_INFINITY) < top) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

export function resolveBodyLineNumberWindow(
  labels: readonly BodyLineNumberLabel[],
  viewportTop: number,
  viewportBottom: number,
  current: BodyLineNumberWindow | null,
): BodyLineNumberWindow {
  if (labels.length <= MAX_RENDERED_BODY_LINE_NUMBERS) {
    return { start: 0, end: labels.length };
  }

  const firstVisible = findFirstLabelAtOrAfter(labels, viewportTop);
  const lastVisible = Math.max(firstVisible, findFirstLabelAtOrAfter(labels, viewportBottom));
  if (
    current &&
    firstVisible >= current.start + BODY_LINE_NUMBER_WINDOW_BUFFER &&
    lastVisible <= current.end - BODY_LINE_NUMBER_WINDOW_BUFFER
  ) {
    return current;
  }

  const maxStart = labels.length - MAX_RENDERED_BODY_LINE_NUMBERS;
  const start = Math.min(
    maxStart,
    Math.max(0, firstVisible - BODY_LINE_NUMBER_WINDOW_BUFFER),
  );
  return {
    start,
    end: start + MAX_RENDERED_BODY_LINE_NUMBERS,
  };
}
