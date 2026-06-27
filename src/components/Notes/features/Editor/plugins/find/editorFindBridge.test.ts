import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getEditorFindSnapshot,
  publishEditorFindSnapshot,
  subscribeEditorFindSnapshot,
} from './editorFindBridge';
import { EMPTY_DECORATIONS, type EditorFindPluginState } from './editorFindState';

function createState(overrides: Partial<EditorFindPluginState> = {}): EditorFindPluginState {
  return {
    query: '',
    matches: [],
    activeIndex: -1,
    decorations: EMPTY_DECORATIONS,
    ...overrides,
  };
}

describe('editorFindBridge', () => {
  afterEach(() => {
    publishEditorFindSnapshot(null, null);
  });

  it('does not notify subscribers when the published snapshot is unchanged', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeEditorFindSnapshot(listener);
    const view = { id: 'editor-view' } as never;
    const state = createState();

    publishEditorFindSnapshot(view, state);
    expect(listener).toHaveBeenCalledTimes(1);
    const snapshot = getEditorFindSnapshot();

    publishEditorFindSnapshot(view, state);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getEditorFindSnapshot()).toBe(snapshot);
    unsubscribe();
  });

  it('reuses the empty matches snapshot for equivalent empty find states', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeEditorFindSnapshot(listener);
    const view = { id: 'editor-view' } as never;

    publishEditorFindSnapshot(view, createState());
    expect(listener).toHaveBeenCalledTimes(1);
    const snapshot = getEditorFindSnapshot();

    publishEditorFindSnapshot(view, createState({ matches: [] }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getEditorFindSnapshot()).toBe(snapshot);
    unsubscribe();
  });
});
