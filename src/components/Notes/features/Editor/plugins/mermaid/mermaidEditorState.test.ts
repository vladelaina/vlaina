import { describe, expect, it } from 'vitest';
import {
  createClosedMermaidEditorState,
  createOpenMermaidEditorState,
  shouldDiscardEmptyMermaidNodeOnCancel,
} from './mermaidEditorState';

describe('mermaidEditorState', () => {
  it('creates the default closed editor state', () => {
    expect(createClosedMermaidEditorState()).toEqual({
      isOpen: false,
      code: '',
      position: { x: 0, y: 0 },
      nodePos: -1,
      openSource: null,
    });
  });

  it('creates open editor states with explicit source metadata', () => {
    expect(
      createOpenMermaidEditorState({
        code: 'graph TD\nA --> B',
        position: { x: 12, y: 24 },
        nodePos: 8,
        openSource: 'existing-node',
      })
    ).toEqual({
      isOpen: true,
      code: 'graph TD\nA --> B',
      position: { x: 12, y: 24 },
      nodePos: 8,
      openSource: 'existing-node',
    });
  });

  it('only discards untouched empty nodes created from the shortcut flow', () => {
    const freshState = createOpenMermaidEditorState({
      code: '',
      position: { x: 0, y: 0 },
      nodePos: 4,
      openSource: 'new-empty-block',
    });
    const existingState = createOpenMermaidEditorState({
      code: '',
      position: { x: 0, y: 0 },
      nodePos: 4,
      openSource: 'existing-node',
    });

    expect(shouldDiscardEmptyMermaidNodeOnCancel(freshState, '')).toBe(true);
    expect(shouldDiscardEmptyMermaidNodeOnCancel(freshState, 'graph TD')).toBe(false);
    expect(shouldDiscardEmptyMermaidNodeOnCancel(existingState, '')).toBe(false);
    expect(shouldDiscardEmptyMermaidNodeOnCancel(createClosedMermaidEditorState(), '')).toBe(false);
  });
});
