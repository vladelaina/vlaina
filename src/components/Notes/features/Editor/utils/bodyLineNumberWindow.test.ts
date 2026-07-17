import { describe, expect, it } from 'vitest';
import {
  MAX_RENDERED_BODY_LINE_NUMBERS,
  resolveBodyLineNumberWindow,
} from './bodyLineNumberWindow';

const labels = Array.from({ length: 1000 }, (_, index) => ({
  lineNumber: index + 1,
  left: 0,
  top: index * 24,
}));

describe('body line number window', () => {
  it('renders all labels for bounded documents', () => {
    expect(resolveBodyLineNumberWindow(labels.slice(0, 10), 0, 200, null)).toEqual({
      start: 0,
      end: 10,
    });
  });

  it('keeps a bounded window around the viewport', () => {
    const window = resolveBodyLineNumberWindow(labels, 12_000, 12_800, null);
    expect(window.end - window.start).toBe(MAX_RENDERED_BODY_LINE_NUMBERS);
    expect(labels[window.start]?.top).toBeLessThanOrEqual(12_000);
    expect(labels[window.end - 1]?.top).toBeGreaterThanOrEqual(12_800);
  });

  it('reuses the current window while the viewport remains buffered', () => {
    const current = { start: 400, end: 720 };
    expect(resolveBodyLineNumberWindow(labels, 500 * 24, 550 * 24, current)).toBe(current);
  });
});
