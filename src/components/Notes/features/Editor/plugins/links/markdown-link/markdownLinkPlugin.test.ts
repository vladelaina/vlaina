import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import {
  MAX_MARKDOWN_LINK_AUTO_COLLAPSE_MATCHES,
  MAX_MARKDOWN_LINK_DOC_SCAN_NODES,
  MAX_MARKDOWN_LINK_INPUT_LOOKBACK_CHARS,
  MAX_MARKDOWN_LINK_TEXT_SCAN_CHARS,
  collectRawMarkdownLinkMatches,
  docHasRawMarkdownLink,
  getMarkdownLinkInputTextBeforeCursor,
  isMarkdownImagePatternBeforeCursor,
  markdownLinkPlugin,
  rangeTouchesRawMarkdownLink,
} from './markdownLinkPlugin';
import { shouldHandleMarkdownLinkPaste } from './markdownLinkParser';

interface FakeMarkdownLinkNode {
  child?: (index: number) => FakeMarkdownLinkNode | null | undefined;
  childCount?: number;
  content?: { size?: number };
  isText?: boolean;
  nodeSize?: number;
  text?: string;
  type?: { name?: string };
}

function createTextNode(text: string): FakeMarkdownLinkNode {
  return {
    isText: true,
    nodeSize: text.length,
    text,
    type: { name: 'text' },
  };
}

function createDocNode(children: FakeMarkdownLinkNode[], onAccess?: () => void): FakeMarkdownLinkNode {
  return {
    childCount: children.length,
    child(index) {
      onAccess?.();
      return children[index];
    },
    content: {
      size: children.reduce((size, child) => size + (child.nodeSize ?? 1), 0),
    },
    type: { name: 'doc' },
  };
}

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

function getFirstLinkHref(view: any): string | null {
  let href: string | null = null;
  view.state.doc.descendants((node: any) => {
    const link = node.marks?.find((mark: any) => mark.type.name === 'link');
    if (!link) return true;
    href = link.attrs.href;
    return false;
  });
  return href;
}

describe('shouldHandleMarkdownLinkPaste', () => {
  it('stops scanning for raw markdown links after the first match', () => {
    let accessed = 0;
    const doc = createDocNode([
      createTextNode('[Docs](https://example.com)'),
      createTextNode('[Later](https://later.example)'),
    ], () => {
      accessed += 1;
    });

    expect(docHasRawMarkdownLink(doc as any)).toBe(true);
    expect(accessed).toBe(1);
  });

  it('caps raw markdown link presence scans by node count', () => {
    let accessed = 0;
    const doc = createDocNode([
      ...Array.from({ length: MAX_MARKDOWN_LINK_DOC_SCAN_NODES }, () => createTextNode('plain')),
      createTextNode('[Later](https://later.example)'),
    ], () => {
      accessed += 1;
    });

    expect(docHasRawMarkdownLink(doc as any)).toBe(false);
    expect(accessed).toBe(MAX_MARKDOWN_LINK_DOC_SCAN_NODES);
  });

  it('caps raw markdown link auto-collapse candidates collected in one pass', () => {
    const doc = createDocNode(Array.from(
      { length: MAX_MARKDOWN_LINK_AUTO_COLLAPSE_MATCHES + 2 },
      (_value, index) => createTextNode(`[Link ${index}](https://example.com/${index})`)
    ));

    expect(collectRawMarkdownLinkMatches(doc as any)).toHaveLength(MAX_MARKDOWN_LINK_AUTO_COLLAPSE_MATCHES);
  });

  it('bounds raw markdown link presence scans within a single large text node', () => {
    const doc = createDocNode([
      createTextNode(`${'x'.repeat(MAX_MARKDOWN_LINK_TEXT_SCAN_CHARS)} [Later](https://later.example)`),
    ]);

    expect(docHasRawMarkdownLink(doc as any)).toBe(false);
  });

  it('bounds raw markdown link collection within a single large text node', () => {
    const doc = createDocNode([
      createTextNode(`${'x'.repeat(MAX_MARKDOWN_LINK_TEXT_SCAN_CHARS)} [Later](https://later.example)`),
    ]);

    expect(collectRawMarkdownLinkMatches(doc as any)).toEqual([]);
  });

  it('stops raw markdown link range prechecks after the first match', () => {
    let accessed = 0;
    const doc = createDocNode([
      createTextNode('[Docs](https://example.com)'),
      ...Array.from({ length: MAX_MARKDOWN_LINK_DOC_SCAN_NODES }, () => createTextNode('plain')),
    ], () => {
      accessed += 1;
    });

    expect(rangeTouchesRawMarkdownLink(doc as any, 0, doc.content?.size ?? 0, false)).toBe(true);
    expect(accessed).toBe(1);
  });

  it('bounds markdown link input lookback text reads', () => {
    const textBetweenCalls: Array<[number, number, string | null | undefined, string | null | undefined]> = [];
    const parent = {
      textBetween(from: number, to: number, blockSeparator?: string | null, leafText?: string | null) {
        textBetweenCalls.push([from, to, blockSeparator, leafText]);
        return '[Docs](https://example.com)';
      },
    };
    const parentOffset = MAX_MARKDOWN_LINK_INPUT_LOOKBACK_CHARS + 500;

    expect(getMarkdownLinkInputTextBeforeCursor(parent, parentOffset)).toBe('[Docs](https://example.com)');
    expect(textBetweenCalls).toEqual([[500, parentOffset, '\0', '\0']]);
  });

  it('handles single-line markdown link text', () => {
    expect(shouldHandleMarkdownLinkPaste('Read [Docs](https://example.com)')).toBe(true);
  });

  it('does not handle markdown image syntax as a link paste', () => {
    expect(
      shouldHandleMarkdownLinkPaste('![百度](https://www.baidu.com/img/PCfb_5bf082d29588c07f842ccde3f97243ea.png "百度一下，你就知道")'),
    ).toBe(false);
    expect(shouldHandleMarkdownLinkPaste('before ![Alt](image.png) after')).toBe(false);
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

  it('pastes entity-encoded unsafe markdown links as plain text', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, '[Bad](javascript&colon;alert)')).toBe(true);

    expect(view.state.doc.textContent).toBe('Bad');
    const linkMark = view.state.schema.marks.link;
    expect(view.state.doc.rangeHasMark(0, view.state.doc.content.size, linkMark)).toBe(false);

    await editor.destroy();
  });

  it('pastes escaped unsafe markdown links as plain text', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, String.raw`[Bad](javascript\:alert)`)).toBe(true);

    expect(view.state.doc.textContent).toBe('Bad');
    const linkMark = view.state.schema.marks.link;
    expect(view.state.doc.rangeHasMark(0, view.state.doc.content.size, linkMark)).toBe(false);

    await editor.destroy();
  });

  it('pastes protocol-relative markdown links as plain text', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, '[Bad](//example.com)')).toBe(true);

    expect(view.state.doc.textContent).toBe('Bad');
    const linkMark = view.state.schema.marks.link;
    expect(view.state.doc.rangeHasMark(0, view.state.doc.content.size, linkMark)).toBe(false);

    await editor.destroy();
  });

  it('pastes internal relative markdown links as plain text', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, '[Secret](.vlaina/workspace.md) [Git](docs/.git/config.md)')).toBe(true);

    expect(view.state.doc.textContent).toBe('Secret Git');
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

  it('pastes angle-bracket markdown link destinations with escaped brackets', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, String.raw`[Docs](<docs/a-\>.md>)`)).toBe(true);

    expect(getFirstLinkHref(view)).toBe('docs/a->.md');
    const serializer = editor.ctx.get(serializerCtx);
    expect(serializer(view.state.doc).trim()).toBe('[Docs](docs/a->.md)');

    await editor.destroy();
  });

  it('unescapes markdown punctuation in explicit link destinations', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, String.raw`[Docs](https\://example.com/a\?q\=1\&b\=2)`)).toBe(true);

    expect(getFirstLinkHref(view)).toBe('https://example.com/a?q=1&b=2');
    const serializer = editor.ctx.get(serializerCtx);
    expect(serializer(view.state.doc).trim()).toBe(String.raw`[Docs](https://example.com/a?q=1\&b=2)`);

    await editor.destroy();
  });

  it('normalizes non-markdown bare domains in explicit markdown links', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, '[Docs](cati.me)')).toBe(true);

    const serializer = editor.ctx.get(serializerCtx);
    expect(serializer(view.state.doc).trim()).toBe('[Docs](https://cati.me)');

    await editor.destroy();
  });

  it('preserves explicit relative markdown file links that look like bare domains', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, '[Docs](catim.md) [Guide](guide.markdown#intro)')).toBe(true);

    const serializer = editor.ctx.get(serializerCtx);
    expect(serializer(view.state.doc).trim()).toBe('[Docs](catim.md) [Guide](guide.markdown#intro)');

    await editor.destroy();
  });

  it('preserves explicit nested relative markdown links', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, '[Docs](docs/safe.md)')).toBe(true);

    const serializer = editor.ctx.get(serializerCtx);
    expect(serializer(view.state.doc).trim()).toBe('[Docs](docs/safe.md)');

    await editor.destroy();
  });

  it('preserves explicit markdown links with balanced parentheses in the destination', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, '[Docs](docs/a(b).md)')).toBe(true);

    const serializer = editor.ctx.get(serializerCtx);
    expect(getFirstLinkHref(view)).toBe('docs/a(b).md');
    expect(serializer(view.state.doc).trim()).toBe(String.raw`[Docs](docs/a\(b\).md)`);

    await editor.destroy();
  });

  it('unescapes balanced parentheses in explicit markdown link destinations', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, String.raw`[Docs](docs/a\(b\).md)`)).toBe(true);

    expect(getFirstLinkHref(view)).toBe('docs/a(b).md');
    const serializer = editor.ctx.get(serializerCtx);
    expect(serializer(view.state.doc).trim()).toBe(String.raw`[Docs](docs/a\(b\).md)`);

    await editor.destroy();
  });

  it('decodes entity references in explicit markdown link destinations', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, '[Docs](docs&sol;safe&period;md)')).toBe(true);

    const serializer = editor.ctx.get(serializerCtx);
    expect(serializer(view.state.doc).trim()).toBe('[Docs](docs/safe.md)');

    await editor.destroy();
  });

  it('pastes markdown mailto links but persists matching email labels as plain emails', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(markdownLinkPlugin);

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, '[v.lad.el.a.ina@gmail.com](mailto:v.lad.el.a.ina@gmail.com)')).toBe(true);

    const serializer = editor.ctx.get(serializerCtx);
    expect(normalizeSerializedMarkdownDocument(serializer(view.state.doc)).trim()).toBe(
      'v.lad.el.a.ina@gmail.com'
    );

    await editor.destroy();
  });
});

describe('markdownLinkPlugin text input', () => {
  it('detects markdown image syntax with paragraph-relative positions', () => {
    const textBefore = 'prefix ![Alt](image.png)';
    const fullMatch = '[Alt](image.png)';

    expect(isMarkdownImagePatternBeforeCursor(textBefore, fullMatch)).toBe(true);
    expect(isMarkdownImagePatternBeforeCursor('[Alt](image.png)', fullMatch)).toBe(false);
  });
});
