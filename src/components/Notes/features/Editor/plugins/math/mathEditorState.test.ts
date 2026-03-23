import { describe, expect, it } from 'vitest';
import {
  createClosedMathEditorState,
  createOpenMathEditorState,
  shouldDiscardEmptyMathNodeOnCancel,
} from './mathEditorState';

describe('mathEditorState', () => {
  it('creates the default closed editor state', () => {
    expect(createClosedMathEditorState()).toEqual({
      isOpen: false,
      latex: '',
      displayMode: false,
      position: { x: 0, y: 0 },
      nodePos: -1,
      openSource: null,
    });
  });

  it('creates open editor states with explicit source metadata', () => {
    expect(
      createOpenMathEditorState({
        latex: 'x^2',
        displayMode: true,
        position: { x: 12, y: 24 },
        nodePos: 8,
        openSource: 'existing-node',
      })
    ).toEqual({
      isOpen: true,
      latex: 'x^2',
      displayMode: true,
      position: { x: 12, y: 24 },
      nodePos: 8,
      openSource: 'existing-node',
    });
  });

  it('only discards untouched empty nodes created from the shortcut flow', () => {
    const freshState = createOpenMathEditorState({
      latex: '',
      displayMode: true,
      position: { x: 0, y: 0 },
      nodePos: 4,
      openSource: 'new-empty-block',
    });
    const existingState = createOpenMathEditorState({
      latex: '',
      displayMode: true,
      position: { x: 0, y: 0 },
      nodePos: 4,
      openSource: 'existing-node',
    });

    expect(shouldDiscardEmptyMathNodeOnCancel(freshState, '')).toBe(true);
    expect(shouldDiscardEmptyMathNodeOnCancel(freshState, 'x')).toBe(false);
    expect(shouldDiscardEmptyMathNodeOnCancel(existingState, '')).toBe(false);
    expect(shouldDiscardEmptyMathNodeOnCancel(createClosedMathEditorState(), '')).toBe(false);
  });
});
