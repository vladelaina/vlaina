import { describe, expect, it } from 'vitest';
import {
  buildOutlineElementMap,
  buildOutlinePositionMap,
  readOutlineHeadingMetrics,
  selectActiveOutlineHeadingId,
} from './outlinePositionCache';

describe('outlinePositionCache', () => {
  it('reads heading metrics with stable ids and top offsets', () => {
    const scrollRoot = document.createElement('div');
    const editorRoot = document.createElement('div');
    scrollRoot.appendChild(editorRoot);
    scrollRoot.scrollTop = 120;

    scrollRoot.getBoundingClientRect = () => ({
      bottom: 800,
      height: 800,
      left: 0,
      right: 600,
      top: 40,
      width: 600,
      x: 0,
      y: 40,
      toJSON: () => ({}),
    });

    const headingOne = document.createElement('h1');
    headingOne.textContent = 'Alpha';
    headingOne.getBoundingClientRect = () => ({
      bottom: 100,
      height: 40,
      left: 0,
      right: 300,
      top: 60,
      width: 300,
      x: 0,
      y: 60,
      toJSON: () => ({}),
    });

    const headingTwo = document.createElement('h2');
    headingTwo.textContent = 'Beta';
    headingTwo.getBoundingClientRect = () => ({
      bottom: 360,
      height: 48,
      left: 0,
      right: 300,
      top: 312,
      width: 300,
      x: 0,
      y: 312,
      toJSON: () => ({}),
    });

    editorRoot.append(headingOne, headingTwo);

    const metrics = readOutlineHeadingMetrics(editorRoot, scrollRoot);

    expect(metrics.map(({ id, level, text, top }) => ({ id, level, text, top }))).toEqual([
      {
        id: 'outline-0-h1-alpha',
        level: 1,
        text: 'Alpha',
        top: 140,
      },
      {
        id: 'outline-1-h2-beta',
        level: 2,
        text: 'Beta',
        top: 392,
      },
    ]);
    expect(buildOutlineElementMap(metrics).get('outline-1-h2-beta')).toBe(headingTwo);
    expect(buildOutlinePositionMap(metrics).get('outline-0-h1-alpha')).toBe(140);
  });

  it('selects the active heading from cached positions', () => {
    const metrics = [
      {
        id: 'a',
        level: 1,
        text: 'A',
        top: 0,
        element: document.createElement('h1'),
      },
      {
        id: 'b',
        level: 2,
        text: 'B',
        top: 220,
        element: document.createElement('h2'),
      },
      {
        id: 'c',
        level: 2,
        text: 'C',
        top: 480,
        element: document.createElement('h2'),
      },
    ];

    expect(selectActiveOutlineHeadingId(metrics, 0, 72, 12)).toBe('a');
    expect(selectActiveOutlineHeadingId(metrics, 168, 72, 12)).toBe('b');
    expect(selectActiveOutlineHeadingId(metrics, 396, 72, 12)).toBe('c');
  });
});
