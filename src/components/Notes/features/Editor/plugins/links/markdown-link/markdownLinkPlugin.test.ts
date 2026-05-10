import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { markdownLinkPlugin, shouldHandleMarkdownLinkPaste } from './markdownLinkPlugin';

function simulatePasteText(view: any, text: string): boolean {
  const event = {
    clipboardData: {
      getData(type: string) {
        return type === 'text/plain' ? text : '';
      },
    },
    preventDefault() {},
  };

  let handled = false;
  view.someProp('handlePaste', (handlePaste: any) => {
    handled = handlePaste(view, event, null) || handled;
  });
  return handled;
}

function insertEmptyParagraphAfterDocumentEnd(view: any): void {
  const paragraphType = view.state.schema.nodes.paragraph;
  const tr = view.state.tr.insert(view.state.doc.content.size, paragraphType.create());
  const cursorPos = tr.doc.content.size - 1;
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursorPos)));
}

describe('shouldHandleMarkdownLinkPaste', () => {
  it('handles single-line markdown link text', () => {
    expect(shouldHandleMarkdownLinkPaste('Read [Docs](https://example.com)')).toBe(true);
  });

  it('does not handle standalone URLs as markdown links', () => {
    expect(shouldHandleMarkdownLinkPaste('https://example.com')).toBe(false);
    expect(shouldHandleMarkdownLinkPaste('http://example.test:8317')).toBe(false);
  });

  it('handles localized markdown link text', () => {
    expect(shouldHandleMarkdownLinkPaste('阅读【文档】（https://example.com）')).toBe(true);
    expect(shouldHandleMarkdownLinkPaste('阅读[文档】（https://example.com)')).toBe(true);
  });

  it('does not handle multiline markdown content', () => {
    expect(
      shouldHandleMarkdownLinkPaste('# Title\n\n[Docs](https://example.com)\n- item'),
    ).toBe(false);
  });

  it('does not handle structural markdown line with link', () => {
    expect(shouldHandleMarkdownLinkPaste('# [Docs](https://example.com)')).toBe(false);
    expect(shouldHandleMarkdownLinkPaste('- [Docs](https://example.com)')).toBe(false);
    expect(shouldHandleMarkdownLinkPaste('＃ 【文档】（https://example.com）')).toBe(false);
  });

  it('does not handle standalone fenced code block payload', () => {
    expect(
      shouldHandleMarkdownLinkPaste('```markdown\n[Docs](https://example.com)\n```'),
    ).toBe(false);
  });

  it('pastes markdown links into the current empty line instead of the previous line tail', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, 'first');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    insertEmptyParagraphAfterDocumentEnd(view);

    expect(simulatePasteText(view, '[Docs](https://example.com)')).toBe(true);

    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).textContent).toBe('first');
    expect(view.state.doc.child(1).textContent).toBe('Docs');

    await editor.destroy();
  });

  it('pastes unsafe markdown links as plain text', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, '[Bad](javascript:alert)')).toBe(true);

    expect(view.state.doc.textContent).toBe('Bad');
    const linkMark = view.state.schema.marks.link;
    expect(view.state.doc.rangeHasMark(0, view.state.doc.content.size, linkMark)).toBe(false);

    await editor.destroy();
  });

  it('pastes markdown links with titles using only the href for the link mark', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, '[Docs](https://example.com "Docs title")')).toBe(true);

    const serializer = editor.ctx.get(serializerCtx);
    expect(serializer(view.state.doc).trim()).toBe('[Docs](https://example.com)');

    await editor.destroy();
  });

  it('pastes angle-bracket markdown link destinations without persisting brackets in href', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, '[Docs](<https://example.com/path>)')).toBe(true);

    const serializer = editor.ctx.get(serializerCtx);
    expect(serializer(view.state.doc).trim()).toBe('[Docs](https://example.com/path)');

    await editor.destroy();
  });
});
