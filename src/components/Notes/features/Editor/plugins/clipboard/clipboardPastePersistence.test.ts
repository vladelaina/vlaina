import { describe, expect, it, vi } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import {
  normalizeSerializedMarkdownDocument,
  stripTrailingNewlines,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import { configureTheme } from '../../theme';
import {
  serializeLeadingFrontmatterMarkdown,
} from '../frontmatter/frontmatterMarkdown';
import { clipboardPlugin } from './clipboardPlugin';
import { frontmatterPlugin } from '../frontmatter';
import { calloutPlugin } from '../callout';
import { footnotePlugin } from '../footnote';
import { mathPlugin } from '../math';
import { mermaidPlugin } from '../mermaid';
import { codePlugin } from '../code';
import { highlightPlugin } from '../highlight';
import { colorMarksPlugin } from '../floating-toolbar';
import { videoPlugin } from '../video';
import { tocPlugin } from '../toc';
import { blockAlignmentPlugin } from '../floating-toolbar';
import { markdownLinkPlugin } from '../links/markdown-link/markdownLinkPlugin';

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
    handled = handlePaste(view, event, null) || handled;
  });
  return handled;
}

async function createPasteEditor(options: { includeMarkdownLinkPlugin?: boolean } = {}) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, '');
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(configureTheme);

  if (options.includeMarkdownLinkPlugin) {
    editor.use(markdownLinkPlugin);
  }

  editor.use(clipboardPlugin);

  for (const plugin of [
    ...frontmatterPlugin,
    ...calloutPlugin,
    ...footnotePlugin,
    ...mathPlugin,
    ...mermaidPlugin,
    ...codePlugin,
    ...highlightPlugin,
    ...colorMarksPlugin,
    ...videoPlugin,
    ...tocPlugin,
    ...blockAlignmentPlugin,
  ]) {
    editor.use(plugin);
  }

  await editor.create();
  return editor;
}

async function pasteAndPersist(markdown: string) {
  const editor = await createPasteEditor();
  return pasteAndPersistWithEditor(editor, markdown);
}

async function pasteAndPersistWithEditor(editor: any, markdown: string) {
  const view = editor.ctx.get(editorViewCtx);
  expect(simulatePasteText(view, markdown)).toBe(true);

  const serializer = editor.ctx.get(serializerCtx);
  const persisted = stripTrailingNewlines(
    serializeLeadingFrontmatterMarkdown(
      normalizeSerializedMarkdownDocument(serializer(view.state.doc)),
      markdown
    )
  );

  await editor.destroy();
  return persisted;
}

describe('clipboard paste markdown persistence', () => {
  it.each([
    ['frontmatter', ['---', 'title: Demo', '---', '# Heading'].join('\n')],
    ['footnote', ['Footnote ref[^1].', '', '[^1]: Footnote body'].join('\n')],
    ['math', ['Inline $x + y$.', '', '$$', 'x^2', '$$'].join('\n')],
    ['mermaid', ['```mermaid', 'flowchart TD', 'A --> B', '```'].join('\n')],
    ['custom inline marks', '==highlight== ++underlined++ X^2^ H~2~O'],
    ['color html', '<span style="color: #123456">red</span> <mark style="background-color: #ecf6ff">bg</mark>'],
    ['toc', '[TOC]'],
  ] as const)('preserves pasted %s markdown on save', async (_name, markdown) => {
    await expect(pasteAndPersist(markdown)).resolves.toBe(markdown);
  });

  it.each([
    [
      'image',
      '![A < B](image.png "Title & More")',
      '<img src="image.png" alt="A &lt; B" title="Title &amp; More" />',
    ],
    [
      'video',
      '![video](https://example.com/video.mp4 "Demo video")',
      '<img src="https://example.com/video.mp4" alt="video" title="Demo video" />',
    ],
  ] as const)('persists pasted %s markdown as html image syntax', async (_name, markdown, expected) => {
    await expect(pasteAndPersist(markdown)).resolves.toBe(expected);
  });

  it('persists pasted TSV as a standard GFM table', async () => {
    await expect(pasteAndPersist(['A\tB', '1\t2'].join('\n'))).resolves.toBe(
      ['| A | B |', '| - | - |', '| 1 | 2 |'].join('\n')
    );
  });

  it('normalizes pasted mermaid aliases to canonical mermaid fenced code', async () => {
    await expect(pasteAndPersist(['```sequence', 'Alice->Bob: Hi', '```'].join('\n'))).resolves.toBe(
      ['```mermaid', 'sequenceDiagram', 'Alice->Bob: Hi', '```'].join('\n')
    );
  });

  it('keeps literal trailing backslashes in plain text paste', async () => {
    const pasted = [
      '7）视图模式：支持大纲和文档列表视图，方便在不同段落和不同文件之间进行切换。\\',
      '8）跨平台：支持macOS、Windows和Linux系统。\\',
      '9）目前免费：这么好用的编辑器竟然是免费的。',
    ].join('\n');

    await expect(pasteAndPersist(pasted)).resolves.toBe([
      '7）视图模式：支持大纲和文档列表视图，方便在不同段落和不同文件之间进行切换。\\\\\\',
      '8）跨平台：支持macOS、Windows和Linux系统。\\\\\\',
      '9）目前免费：这么好用的编辑器竟然是免费的。',
    ].join('\n'));
  });

  it('keeps trailing backslashes visible in the editor document after paste', async () => {
    const pasted = [
      '7）视图模式：支持大纲和文档列表视图，方便在不同段落和不同文件之间进行切换。\\',
      '8）跨平台：支持macOS、Windows和Linux系统。\\',
      '9）目前免费：这么好用的编辑器竟然是免费的。',
    ].join('\n');
    const editor = await createPasteEditor();
    const view = editor.ctx.get(editorViewCtx);

    expect(simulatePasteText(view, pasted)).toBe(true);
    expect(view.state.doc.textContent).toContain('切换。\\');
    expect(view.state.doc.textContent).toContain('系统。\\');

    await editor.destroy();
  });

  it('parses single-line markdown images before markdown link paste handling', async () => {
    const editor = await createPasteEditor({ includeMarkdownLinkPlugin: true });
    const markdown = '![百度](https://www.baidu.com/img/PCfb_5bf082d29588c07f842ccde3f97243ea.png "百度一下，你就知道")';

    await expect(pasteAndPersistWithEditor(editor, markdown)).resolves.toBe(
      '<img src="https://www.baidu.com/img/PCfb_5bf082d29588c07f842ccde3f97243ea.png" alt="百度" title="百度一下，你就知道" />'
    );
  });
});
