import { describe, expect, it } from 'vitest';
import {
  createClosedMermaidEditorState,
  createOpenMermaidEditorState,
  shouldDiscardNewMermaidNodeOnCancel,
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

  it('discards temporary nodes created from the shortcut flow when cancelling', () => {
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

    expect(shouldDiscardNewMermaidNodeOnCancel(freshState)).toBe(true);
    expect(shouldDiscardNewMermaidNodeOnCancel(existingState)).toBe(false);
    expect(shouldDiscardNewMermaidNodeOnCancel(createClosedMermaidEditorState())).toBe(false);
  });

  it('discards untouched starter directives created from diagram alias fences', () => {
    const starterState = createOpenMermaidEditorState({
      code: 'sequenceDiagram\n',
      position: { x: 0, y: 0 },
      nodePos: 4,
      openSource: 'new-empty-block',
    });

    expect(shouldDiscardNewMermaidNodeOnCancel(starterState)).toBe(true);
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
