import { describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';

import { clipboardPlugin } from './clipboardPlugin';

function simulatePasteText(view: any, text: string): boolean {
  const event = {
    clipboardData: {
      getData(type: string) {
        return type === 'text/plain' ? text : '';
      },
    },
    preventDefault: vi.fn(),
  };

  let handled = false;
  view.someProp('handlePaste', (handlePaste: any) => {
    const didHandle = handlePaste(view, event, null);
    handled = didHandle || handled;
    return didHandle || undefined;
  });
  return handled;
}

async function createPasteEditor() {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, '');
    })
    .use(commonmark)
    .use(gfm)
    .use(clipboardPlugin);

  await editor.create();
  return editor;
}

describe('clipboard markdown paste matrix', () => {
  it.each([
    ['# Heading 1', 'heading', 'Heading 1', { level: 1 }],
    ['### Heading 3', 'heading', 'Heading 3', { level: 3 }],
    ['###### Heading 6', 'heading', 'Heading 6', { level: 6 }],
    ['- bullet', 'bullet_list', 'bullet', undefined],
    ['1. ordered', 'ordered_list', 'ordered', undefined],
    ['> quote', 'blockquote', 'quote', undefined],
    ['---', 'hr', '', undefined],
  ])('recognizes pasted block markdown: %s', async (markdown, typeName, textContent, attrs) => {
    const editor = await createPasteEditor();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, markdown)).toBe(true);

    const node = view.state.doc.firstChild;
    expect(node?.type.name).toBe(typeName);
    expect(node?.textContent).toBe(textContent);
    if (attrs) {
      expect(node?.attrs).toMatchObject(attrs);
    }

    await editor.destroy();
  });

  it.each([
    ['- [ ] todo', false],
    ['- [x] done', true],
  ])('recognizes pasted task list markdown: %s', async (markdown, checked) => {
    const editor = await createPasteEditor();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, markdown)).toBe(true);

    const list = view.state.doc.firstChild;
    const item = list?.firstChild;
    expect(list?.type.name).toBe('bullet_list');
    expect(item?.type.name).toBe('list_item');
    expect(item?.attrs.checked).toBe(checked);

    await editor.destroy();
  });

  it('recognizes pasted inline markdown marks in the current paragraph', async () => {
    const editor = await createPasteEditor();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, '**bold** [link](https://example.com) `code`')).toBe(true);

    const paragraph = view.state.doc.firstChild;
    expect(paragraph?.type.name).toBe('paragraph');
    expect(paragraph?.textContent).toBe('bold link code');

    const markNames = new Set<string>();
    paragraph?.descendants((node) => {
      if (!node.isText) return;
      node.marks.forEach((mark) => markNames.add(mark.type.name));
    });

    expect(markNames.has('strong')).toBe(true);
    expect(markNames.has('link')).toBe(true);
    expect(markNames.has('inlineCode')).toBe(true);

    await editor.destroy();
  });
});
