import { describe, expect, it } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener } from '@milkdown/kit/plugin/listener';
import { tableBlock } from '@milkdown/kit/component/table-block';
import { notesRemarkStringifyOptions } from './config/stringifyOptions';
import { customPlugins } from './config/plugins';
import { configureTheme } from './theme';
import {
  normalizeAlternativeMathBlockFences,
  preserveMarkdownBlankLinesForEditor,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { normalizeLeadingFrontmatterMarkdown } from './plugins/frontmatter/frontmatterMarkdown';

async function createEditor(markdown: string) {
  const defaultValue = preserveMarkdownBlankLinesForEditor(
    normalizeLeadingFrontmatterMarkdown(
      normalizeAlternativeMathBlockFences(markdown)
    )
  );
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue);
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(listener)
    .use(configureTheme)
    .use(tableBlock)
    .use(customPlugins);

  await editor.create();
  return editor;
}

describe('MarkdownEditor compatibility', () => {
  it('opens markdown containing generated TOC and HTML underline nodes', async () => {
    const editor = await createEditor([
      '# 概述',
      '',
      '[TOC]',
      '',
      '## 下划线',
      '',
      '<u>下划线</u>',
    ].join('\n'));

    const view = editor.ctx.get(editorViewCtx);
    expect(view.state.doc.textContent).toContain('下划线');
    await editor.destroy();
  });

  it.each([
    {
      name: 'definition list',
      markdown: ['Term', '', ': Definition'].join('\n'),
      expectedText: 'TermDefinition',
    },
    {
      name: 'abbreviation',
      markdown: ['*[HTML]: HyperText Markup Language', '', 'HTML demo'].join('\n'),
      expectedText: 'HTML demo',
    },
    {
      name: 'callout container',
      markdown: ['> 💡 Important note'].join('\n'),
      expectedText: 'Important note',
    },
    {
      name: 'inline marks',
      markdown: '==highlight== ^sup^ ~sub~ ++under++ <mark>html</mark> <sup>x</sup> <sub>y</sub> <u>z</u>',
      expectedText: 'highlightsupsubunderhtmlxyz',
    },
    {
      name: 'inline color marks',
      markdown: '<span style="color: #123456">text color</span> <mark style="background-color: #ecf6ff">bg color</mark>',
      expectedText: 'text color bg color',
    },
    {
      name: 'block alignment comments',
      markdown: ['Centered paragraph', '<!--align:center-->', '', '## Right heading', '<!--align:right-->'].join('\n'),
      expectedText: 'Centered paragraphRight heading',
    },
  ])('opens markdown containing $name nodes', async ({ markdown, expectedText }) => {
    const editor = await createEditor(markdown);

    const view = editor.ctx.get(editorViewCtx);
    expect(view.state.doc.textContent.replace(/\s+/g, '')).toContain(expectedText.replace(/\s+/g, ''));
    await editor.destroy();
  });
});
