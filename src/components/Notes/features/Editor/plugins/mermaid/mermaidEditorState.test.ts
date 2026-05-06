import { describe, expect, it } from 'vitest';
import {
  createClosedMermaidEditorState,
  createOpenMermaidEditorState,
  shouldDiscardEmptyMermaidNodeOnCancel,
  shouldRemoveMermaidNodeOnSave,
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

  it('discards untouched starter directives created from diagram alias fences', () => {
    const starterState = createOpenMermaidEditorState({
      code: 'sequenceDiagram\n',
      position: { x: 0, y: 0 },
      nodePos: 4,
      openSource: 'new-empty-block',
    });

    expect(shouldDiscardEmptyMermaidNodeOnCancel(starterState, 'sequenceDiagram\n')).toBe(true);
    expect(shouldDiscardEmptyMermaidNodeOnCancel(starterState, 'sequenceDiagram\nAlice->Bob: Hi')).toBe(false);
  });

  it('removes empty or untouched starter-only nodes on save', () => {
    const starterState = createOpenMermaidEditorState({
      code: 'sequenceDiagram\n',
      position: { x: 0, y: 0 },
      nodePos: 4,
      openSource: 'new-empty-block',
    });
    const existingState = createOpenMermaidEditorState({
      code: 'sequenceDiagram\n',
      position: { x: 0, y: 0 },
      nodePos: 4,
      openSource: 'existing-node',
    });

    expect(shouldRemoveMermaidNodeOnSave(starterState, '')).toBe(true);
    expect(shouldRemoveMermaidNodeOnSave(starterState, 'sequenceDiagram\n')).toBe(true);
    expect(shouldRemoveMermaidNodeOnSave(starterState, 'sequenceDiagram\nAlice->Bob: Hi')).toBe(false);
    expect(shouldRemoveMermaidNodeOnSave(existingState, 'sequenceDiagram\n')).toBe(false);
  });
});
