import { describe, expect, it } from 'vitest';
import { act, waitFor } from '@testing-library/react';
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

  await act(async () => {
    await editor.create();
  });
  return editor;
}

async function destroyEditor(editor: { destroy: () => Promise<unknown> | unknown }) {
  await act(async () => {
    await editor.destroy();
  });
}

describe('MarkdownEditor compatibility', () => {
  it('adds Typora and Obsidian theme alias classes to the editor root', async () => {
    const editor = await createEditor('# Theme aliases');

    const view = editor.ctx.get(editorViewCtx);
    const themeRoot = view.dom.closest<HTMLElement>('[data-markdown-theme-root="true"]')
      ?? view.dom.querySelector<HTMLElement>('[data-markdown-theme-root="true"]');

    expect(themeRoot).toBeInstanceOf(HTMLElement);
    expect(themeRoot?.id).toBe('write');
    expect(themeRoot?.classList.contains('done')).toBe(true);
    expect(themeRoot?.classList.contains('max')).toBe(true);
    expect(themeRoot?.classList.contains('markdown-preview-view')).toBe(true);
    expect(themeRoot?.classList.contains('markdown-rendered')).toBe(true);
    expect(themeRoot?.classList.contains('markdown-reading-view')).toBe(true);
    expect(themeRoot?.classList.contains('markdown-preview-section')).toBe(true);
    expect(themeRoot?.classList.contains('markdown-source-view')).toBe(true);
    expect(themeRoot?.classList.contains('cm-s-obsidian')).toBe(true);
    expect(themeRoot?.classList.contains('mod-cm6')).toBe(true);
    expect(themeRoot?.classList.contains('is-live-preview')).toBe(true);
    expect(themeRoot?.classList.contains('is-readable-line-width')).toBe(true);
    await destroyEditor(editor);
  });

  it('adds Typora and Obsidian theme alias classes to common markdown nodes', async () => {
    const editor = await createEditor([
      '---',
      'title: Demo',
      '---',
      '',
      '# Heading',
      '',
      'Paragraph with `inline code`, #project/tag, [external](https://example.com), and [local](docs/page.md).',
      '',
      '> quote',
      '',
      '---',
      '',
      '- bullet item',
      '1. ordered item',
      '',
      '- [x] done',
      '',
      '![Alt](./assets/demo.png)',
      '',
      '> 💡 Important note',
      '',
      '$$',
      'x^2',
      '$$',
      '',
      '```ts',
      'const a = 1;',
      '```',
      '',
      '<div>',
      '<p>HTML Block</p>',
      '</div>',
    ].join('\n'));

    const view = editor.ctx.get(editorViewCtx);

    const frontmatter = view.dom.querySelector('.frontmatter-block-container.md-meta-block');
    expect(frontmatter).toBeInstanceOf(HTMLElement);

    const heading = view.dom.querySelector('h1');
    expect(heading?.classList.contains('HyperMD-header')).toBe(true);
    expect(heading?.classList.contains('HyperMD-header-1')).toBe(true);
    expect(heading?.classList.contains('cm-header')).toBe(true);
    expect(heading?.classList.contains('cm-header-1')).toBe(true);
    expect(heading?.classList.contains('cm-line')).toBe(true);

    const paragraph = view.dom.querySelector('p.md-p.cm-line');
    expect(paragraph).toBeInstanceOf(HTMLParagraphElement);
    expect(paragraph?.textContent).toContain('Paragraph with');
    expect(paragraph?.classList.contains('first-p')).toBe(false);

    const inlineCode = view.dom.querySelector('p code.v-std-code.cm-inline-code');
    expect(inlineCode).toBeInstanceOf(HTMLElement);
    expect(inlineCode?.textContent).toBe('inline code');

    const tagToken = view.dom.querySelector('.editor-tag-token.tag.cm-hashtag.cm-meta.v-tag[data-editor-tag-token="true"]');
    expect(tagToken).toBeInstanceOf(HTMLElement);
    expect(tagToken?.textContent).toBe('#project/tag');

    const externalLink = view.dom.querySelector('a[href="https://example.com"].external-link');
    expect(externalLink).toBeInstanceOf(HTMLAnchorElement);
    const localLink = view.dom.querySelector('a[href="docs/page.md"]');
    expect(localLink).toBeInstanceOf(HTMLAnchorElement);
    expect(localLink?.classList.contains('external-link')).toBe(false);
    expect(localLink?.classList.contains('internal-link')).toBe(true);

    const quote = view.dom.querySelector('blockquote');
    expect(quote?.classList.contains('v-q')).toBe(true);
    expect(quote?.classList.contains('HyperMD-quote')).toBe(true);
    expect(quote?.classList.contains('cm-hmd-indent-in-quote')).toBe(true);
    expect(quote?.classList.contains('cm-line')).toBe(true);

    const hr = view.dom.querySelector('.md-hr[data-type="hr"] > hr');
    expect(hr).toBeInstanceOf(HTMLHRElement);

    const listItems = Array.from(view.dom.querySelectorAll('li.HyperMD-list-line.cm-line'));
    expect(listItems.length).toBeGreaterThanOrEqual(3);

    const checkedTask = view.dom.querySelector('li.md-task-list-item.task-list-item.HyperMD-task-line.is-checked');
    expect(checkedTask).toBeInstanceOf(HTMLLIElement);
    expect(checkedTask?.classList.contains('HyperMD-list-line')).toBe(true);
    expect(checkedTask?.classList.contains('cm-line')).toBe(true);
    expect(checkedTask?.getAttribute('data-task')).toBe('x');
    expect(checkedTask?.getAttribute('data-checked')).toBe('true');
    expect(checkedTask?.closest('ul')?.classList.contains('contains-task-list')).toBe(true);
    expect(checkedTask?.closest('ul')?.classList.contains('has-list-bullet')).toBe(true);

    const image = view.dom.querySelector('.image-block-container.md-image.image-embed[data-src="./assets/demo.png"]');
    expect(image).toBeInstanceOf(HTMLElement);
    expect(image?.getAttribute('src')).toBe('./assets/demo.png');

    const callout = view.dom.querySelector('.callout[data-callout][data-callout-metadata]');
    expect(callout).toBeInstanceOf(HTMLElement);
    expect(callout?.classList.contains('md-alert')).toBe(true);
    expect(callout?.classList.contains('md-alert-warning')).toBe(true);
    const calloutTitle = callout?.querySelector('.callout-title');
    expect(calloutTitle).toBeInstanceOf(HTMLElement);
    expect(calloutTitle?.classList.contains('md-alert-text-container')).toBe(true);
    expect(calloutTitle?.classList.contains('md-alert-text')).toBe(true);
    expect(calloutTitle?.classList.contains('md-alert-text-warning')).toBe(true);
    expect(callout?.querySelector('.callout-title-inner')).toBeInstanceOf(HTMLElement);
    expect(callout?.querySelector('.callout-content')).toBeInstanceOf(HTMLElement);

    const mathBlock = view.dom.querySelector('.math-block-wrapper.md-math-block.md-fences-math.md-math-container.md-diagram-panel-preview[data-type="math-block"][lang="math"]');
    expect(mathBlock).toBeInstanceOf(HTMLElement);

    const codeBlock = view.dom.querySelector('.code-block-container.md-fences.HyperMD-codeblock.HyperMD-codeblock-bg.language-ts[data-language="ts"][lang="ts"]');
    expect(codeBlock).toBeInstanceOf(HTMLElement);
    expect(codeBlock?.querySelector('.code-block-editable.CodeMirror.cm-s-inner.cm-s-obsidian')).toBeInstanceOf(HTMLElement);
    await waitFor(() => {
      expect(codeBlock?.querySelector('.code-block-flair')).toBeInstanceOf(HTMLElement);
      expect(codeBlock?.querySelector('.copy-code-button')).toBeInstanceOf(HTMLButtonElement);
    });

    const htmlBlock = Array.from(
      view.dom.querySelectorAll<HTMLElement>('[data-type="html-block"].md-htmlblock.md-htmlblock-container')
    ).find((element) => element.dataset.value?.includes('HTML Block'));
    expect(htmlBlock).toBeInstanceOf(HTMLElement);
    expect(htmlBlock?.textContent).toContain('HTML Block');

    await destroyEditor(editor);
  });

  it('adds VLOOK inline semantic classes for Typora theme reuse', async () => {
    const editor = await createEditor([
      '*`rd tag`*',
      '',
      '*og name `value`*',
      '',
      '*==step==*',
      '',
      'prefix *==bu stepwise==* suffix',
      '',
      '***gn coating***',
    ].join('\n'));

    const view = editor.ctx.get(editorViewCtx);

    const tag = view.dom.querySelector('.v-tag');
    expect(tag?.textContent).toBe('rd tag');
    expect(tag?.classList.contains('rd')).toBe(true);
    expect(tag?.classList.contains('em')).toBe(true);

    const badgeName = view.dom.querySelector('.v-badge-name');
    expect(badgeName?.textContent?.replace(/\s+/g, ' ')).toContain('og name');
    expect(badgeName?.classList.contains('og')).toBe(true);
    expect(view.dom.querySelector('.v-badge-value')?.textContent).toBe('value');

    expect(view.dom.querySelector('.v-caption.vlook-caption-block')?.textContent).toBe('step');
    expect(view.dom.querySelector('.v-caption .v-cap-1')?.textContent).toBe('step');

    const stepwise = view.dom.querySelector('.v-stepwise');
    expect(stepwise?.textContent).toBe('bu stepwise');
    expect(stepwise?.classList.contains('bu')).toBe(true);

    const coating = view.dom.querySelector('.v-coating');
    expect(coating?.textContent).toBe('gn coating');
    expect(coating?.classList.contains('gn')).toBe(true);
    expect(coating?.classList.contains('em')).toBe(true);

    await destroyEditor(editor);
  });

  it('adds VLOOK quote semantic classes for Typora theme reuse', async () => {
    const editor = await createEditor([
      '> rd warning quote',
      '',
      '> *og emphasized quote*',
      '',
      '> **Quote Title**',
      '>',
      '> body',
    ].join('\n'));

    const view = editor.ctx.get(editorViewCtx);
    const quotes = Array.from(view.dom.querySelectorAll('blockquote.v-q'));

    expect(quotes[0]?.classList.contains('rd')).toBe(true);
    expect(quotes[0]?.classList.contains('em')).toBe(false);
    expect(quotes[1]?.classList.contains('og')).toBe(true);
    expect(quotes[1]?.classList.contains('em')).toBe(true);
    expect(quotes[2]?.querySelector('p:first-child > strong:only-child')?.textContent).toBe('Quote Title');

    await destroyEditor(editor);
  });

  it('adds VLOOK table semantic classes for Typora theme reuse', async () => {
    const editor = await createEditor([
      '| **Name** | Amount | Rate | Done | Empty | Long | Span |',
      '| --- | ---: | ---: | :---: | --- | --- | --- |',
      '| Ada | $12.50 | -4% | [x] | | this cell contains enough words to use the VLOOK long-cell table style | ==merged look== |',
    ].join('\n'));

    const view = editor.ctx.get(editorViewCtx);
    const tableBlock = view.dom.querySelector('.milkdown-table-block.v-freeze.auto');
    expect(tableBlock).toBeInstanceOf(HTMLElement);
    expect(tableBlock?.classList.contains('table-figure')).toBe(true);

    const table = tableBlock?.querySelector('table');
    expect(table).toBeInstanceOf(HTMLTableElement);

    const amount = Array.from(view.dom.querySelectorAll<HTMLElement>('td'))
      .find((cell) => cell.textContent?.includes('$12.50'));
    expect(amount?.classList.contains('v-tbl-col-fmt-num')).toBe(true);
    expect(amount?.querySelector('.v-tbl-col-fmt-currency')?.textContent).toBe('$');
    expect(amount?.querySelector('.v-tbl-col-fmt-num-decimal')?.textContent).toBe('.50');

    const rate = Array.from(view.dom.querySelectorAll<HTMLElement>('td'))
      .find((cell) => cell.textContent?.includes('-4%'));
    expect(rate?.classList.contains('v-tbl-col-fmt-num')).toBe(true);
    expect(rate?.querySelector('.v-tbl-col-fmt-percent')?.textContent).toBe('%');
    expect(rate?.classList.contains('v-tbl-col-fmt-num-negative')).toBe(true);

    const checkbox = view.dom.querySelector<HTMLElement>('td.v-tbl-col-fmt-chkbox[data-vlook-checkbox="checked"]');
    expect(checkbox?.textContent).toContain('[x]');
    expect(
      checkbox?.querySelector('.v-svg-input-checkbox[data-vlook-checkbox="checked"]')
    ).toBeInstanceOf(HTMLElement);

    expect(view.dom.querySelector('td.v-empty-cell')).toBeInstanceOf(HTMLTableCellElement);
    expect(view.dom.querySelector('td.v-long')).toBeInstanceOf(HTMLTableCellElement);
    expect(view.dom.querySelector('td.v-table-colspan-all')).toBeInstanceOf(HTMLTableCellElement);

    await destroyEditor(editor);
  });

  it('adds VLOOK first block and table figure classes for Typora layout rules', async () => {
    const editor = await createEditor([
      'Intro paragraph',
      '',
      '- First list item',
      '',
      '| Name | Amount |',
      '| --- | ---: |',
      '| Ada | 12 |',
    ].join('\n'));

    const view = editor.ctx.get(editorViewCtx);

    const firstParagraph = view.dom.querySelector('p.md-p.cm-line.first-p');
    expect(firstParagraph).toBeInstanceOf(HTMLParagraphElement);
    expect(firstParagraph?.textContent).toBe('Intro paragraph');

    const list = view.dom.querySelector('ul.has-list-bullet');
    expect(list).toBeInstanceOf(HTMLUListElement);
    expect(list?.classList.contains('first-p')).toBe(false);

    const tableBlock = view.dom.querySelector('.milkdown-table-block.table-figure');
    expect(tableBlock).toBeInstanceOf(HTMLElement);
    expect(tableBlock?.querySelector('table.children')).toBeInstanceOf(HTMLTableElement);

    await destroyEditor(editor);
  });

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
    await waitFor(() => {
      expect(view.dom.querySelector('.toc-block.md-toc')).toBeInstanceOf(HTMLElement);
      expect(view.dom.querySelector('.toc-content.md-toc-content')).toBeInstanceOf(HTMLElement);
      expect(view.dom.querySelector('.toc-item.md-toc-item.md-toc-h1')).toBeInstanceOf(HTMLElement);
      expect(view.dom.querySelector('.toc-link.md-toc-inner')).toBeInstanceOf(HTMLAnchorElement);
    });
    expect(view.state.doc.textContent).toContain('下划线');
    await destroyEditor(editor);
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
    await destroyEditor(editor);
  });

  it('does not decorate escaped definition-list markers as definition lists', async () => {
    const editor = await createEditor(['Term', '', '\\: Definition'].join('\n'));

    const view = editor.ctx.get(editorViewCtx);
    expect(view.dom.querySelector('.editor-dl-term')).toBeNull();
    expect(view.dom.querySelector('.editor-dl-desc')).toBeNull();
    await destroyEditor(editor);
  });
});
