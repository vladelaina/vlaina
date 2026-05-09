import { afterEach, describe, expect, it } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  parserCtx,
  serializerCtx,
  editorViewCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { TextSelection } from '@milkdown/kit/prose/state';
import {
  clearCurrentMarkdownRuntime,
  setCurrentMarkdownRuntime,
} from '../../../utils/editorViewRegistry';
import { applyAiSelectionSuggestion } from './selectionEditing';

describe('AI selection editing markdown persistence', () => {
  afterEach(() => {
    clearCurrentMarkdownRuntime();
  });

  it('parses AI markdown output before replacing a text selection', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, 'Body');
      })
      .use(commonmark);

    await editor.create();
    setCurrentMarkdownRuntime({ parser: editor.ctx.get(parserCtx) });
    const view = editor.ctx.get(editorViewCtx);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 5)));

    const applied = applyAiSelectionSuggestion(view, {
      requestKey: 'request',
      from: 1,
      to: 5,
      instruction: 'Edit the selected text.',
      commandId: null,
      toneId: null,
      originalText: 'Body',
      suggestedText: 'Updated **body** with [Docs](https://example.com)',
    });

    const serializer = editor.ctx.get(serializerCtx);
    expect(applied).toBe(true);
    expect(serializer(view.state.doc).trim()).toBe('Updated **body** with [Docs](https://example.com)');

    await editor.destroy();
  });
});
