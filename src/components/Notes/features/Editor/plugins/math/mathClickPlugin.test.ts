import { describe, expect, it } from 'vitest';
import { createInitialMathEditorState } from './mathEditorState';
import { getMathAnchorElement, getMathEditorViewportPosition } from './mathEditorPositioning';
import { resolveMathEditorOpenState } from './mathEditorOpen';

describe('mathClickPlugin', () => {
  it('creates a closed default editor state', () => {
    expect(createInitialMathEditorState()).toEqual({
      isOpen: false,
      latex: '',
      displayMode: false,
      position: { x: 0, y: 0 },
      nodePos: -1,
      removeIfCancelledEmpty: false,
    });
  });

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

    expect(getMathEditorViewportPosition(wrapper)).toEqual({
      x: 120,
      y: 80,
    });
  });

  it('falls back to a safe viewport offset when no anchor element is available', () => {
    expect(getMathEditorViewportPosition(null)).toEqual({
      x: 16,
      y: 16,
    });
  });

  it('resolves an open state for a math node so the editor can open on the first pointer interaction', () => {
    const mathNode = {
      type: { name: 'math_inline' },
      attrs: { latex: 'x+1' },
    };
    const view = {
      state: {
        doc: {
          nodeAt: () => mathNode,
          resolve: () => ({
            depth: 1,
            node: () => mathNode,
            before: () => 5,
          }),
        },
      },
    };

    expect(
      resolveMathEditorOpenState({
        view: view as never,
        pos: 5,
        getPosition: () => ({ x: 20, y: 40 }),
      })
    ).toEqual({
      isOpen: true,
      latex: 'x+1',
      displayMode: false,
      position: { x: 20, y: 40 },
      nodePos: 5,
      removeIfCancelledEmpty: false,
    });
  });
});
