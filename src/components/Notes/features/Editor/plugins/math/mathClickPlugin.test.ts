import { describe, expect, it } from 'vitest';
import { getMathAnchorElement, getMathEditorPosition } from './mathClickPlugin';

describe('mathClickPlugin', () => {
  it('anchors the editor to the closest math wrapper instead of an inner KaTeX token', () => {
    const wrapper = document.createElement('span');
    wrapper.setAttribute('data-type', 'math-inline');
    const inner = document.createElement('span');
    inner.className = 'katex-html';
    wrapper.appendChild(inner);

    expect(getMathAnchorElement(inner, null)).toBe(wrapper);
  });

  it('falls back to the provided node DOM when the click target is outside the wrapper element', () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-type', 'math-block');
    const strayTarget = document.createElement('span');

    expect(getMathAnchorElement(strayTarget, wrapper)).toBe(wrapper);
  });

  it('positions the editor below the anchor rect in viewport coordinates', () => {
    const wrapper = document.createElement('span');
    Object.defineProperty(wrapper, 'getBoundingClientRect', {
      value: () => ({
        left: 120,
        right: 180,
        top: 40,
        bottom: 72,
        width: 60,
        height: 32,
        x: 120,
        y: 40,
        toJSON: () => ({}),
      }),
    });

    expect(getMathEditorPosition(wrapper)).toEqual({
      x: 120,
      y: 80,
    });
  });
});
