import type { NotesOutlineHeading } from './types';
import {
  createOutlineHeadingId,
  getHeadingLevelFromTagName,
  normalizeHeadingText,
} from './outlineUtils';

export interface OutlineHeadingMetric extends NotesOutlineHeading {
  element: HTMLElement;
  top: number;
}

export function readOutlineHeadingMetrics(
  editorRoot: HTMLElement,
  scrollRoot: HTMLElement | null,
): OutlineHeadingMetric[] {
  const headingElements = Array.from(
    editorRoot.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'),
  );
  const scrollTop = scrollRoot?.scrollTop ?? 0;
  const scrollRootTop = scrollRoot?.getBoundingClientRect().top ?? 0;

  return headingElements.flatMap((element, index) => {
    const level = getHeadingLevelFromTagName(element.tagName);
    if (!level) {
      return [];
    }

    const text = normalizeHeadingText(element.textContent ?? '');
    const id = createOutlineHeadingId(index, level, text);
    const top = scrollRoot
      ? element.getBoundingClientRect().top - scrollRootTop + scrollTop
      : 0;

    return [{
      id,
      level,
      text,
      element,
      top,
    }];
  });
}

export function buildOutlineElementMap(
  metrics: readonly OutlineHeadingMetric[],
): Map<string, HTMLElement> {
  return new Map(metrics.map((metric) => [metric.id, metric.element]));
}

export function buildOutlinePositionMap(
  metrics: readonly OutlineHeadingMetric[],
): Map<string, number> {
  return new Map(metrics.map((metric) => [metric.id, metric.top]));
}

export function selectActiveOutlineHeadingId(
  metrics: readonly OutlineHeadingMetric[],
  scrollTop: number,
  activeOffsetPx: number,
  activeSnapPx: number,
): string | null {
  if (metrics.length === 0) {
    return null;
  }

  const anchorY = scrollTop + activeOffsetPx;
  let low = 0;
  let high = metrics.length - 1;
  let bestIndex = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const metric = metrics[middle];
    if (!metric) {
      break;
    }

    if (metric.top <= anchorY) {
      bestIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  const bestMetric = metrics[bestIndex];
  const nextMetric = metrics[bestIndex + 1];
  if (!bestMetric) {
    return null;
  }

  if (!nextMetric) {
    return bestMetric.id;
  }

  const nextDistance = nextMetric.top - anchorY;
  const previousDistance = anchorY - bestMetric.top;
  if (nextDistance <= activeSnapPx && nextDistance < previousDistance) {
    return nextMetric.id;
  }

  return bestMetric.id;
}
