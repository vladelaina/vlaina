import { afterEach, describe, expect, it } from 'vitest';
import {
  getCurrentEditorNotePath,
  getCurrentEditorView,
  setCurrentEditorView,
} from './editorViewRegistry';

describe('editor view registry note path', () => {
  afterEach(() => setCurrentEditorView(null));

  it('updates the ready note path with the registered view and clears both together', () => {
    const view = {} as never;

    setCurrentEditorView(view, '/notes/alpha.md');
    expect(getCurrentEditorView()).toBe(view);
    expect(getCurrentEditorNotePath()).toBe('/notes/alpha.md');

    setCurrentEditorView(view, '/notes/beta.md');
    expect(getCurrentEditorNotePath()).toBe('/notes/beta.md');

    setCurrentEditorView(null);
    expect(getCurrentEditorView()).toBeNull();
    expect(getCurrentEditorNotePath()).toBeNull();
  });
});
