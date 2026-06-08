import { expect, test, type Page } from '@playwright/test';
import {
  BLOCK_CONTROLS_SELECTOR,
  EDITOR_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  clearSelectedNoteBlocks,
  collectEditorDomMetrics,
  getOpenBridgePages,
  getSelectableBlocks,
  launchIsolatedElectron,
  openMarkdownFixture,
  scrollElementIntoViewByText,
  scrollNoteToTop,
  selectNoteBlocksByText,
} from './notesE2E';

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function createMarkdownSyntaxFixture(): string {
  return [
    '---',
    'title: E2E Markdown Syntax',
    'tags:',
    '  - e2e',
    '  - markdown',
    '---',
    '',
    '# E2E Markdown Syntax',
    '',
    '[TOC]',
    '',
    '## Heading Coverage',
    '',
    '### Heading Level Three Sentinel',
    '',
    '#### Heading Level Four Sentinel',
    '',
    '##### Heading Level Five Sentinel',
    '',
    '###### Heading Level Six Sentinel',
    '',
    '## Inline Marks And Links',
    '',
    'Inline marks paragraph with **strong text**, __strong underscore text__, *emphasis text*, _emphasis underscore text_, ~~strike text~~, ==highlighted text==, ++underlined text++, ^superscript text^, ~subscript text~, `inline code`, [explicit link](https://example.com/docs), [internal note link](./linked-note.md#target-heading), www.example.org, syntax@example.com, #syntax-tag, and HTML abbreviation usage.',
    '',
    '<span style="color: #2563eb">colored text sentinel</span> and <mark style="background-color: #fde047">background color sentinel</mark> appear in this paragraph.',
    '',
    '*[HTML]: HyperText Markup Language',
    '',
    '## Paragraphs And Breaks',
    '',
    'Soft break line one sentinel',
    'soft break line two sentinel.',
    '',
    'Hard break line one sentinel  ',
    'hard break line two sentinel.',
    '',
    'HTML break line one sentinel<br/>HTML break line two sentinel.',
    '',
    'Escaped syntax sentinel: \\# not a heading, \\[TOC\\], \\*not emphasis\\*, and \\!\\[not image\\](image.png).',
    '',
    '## Block Quotes And Callouts',
    '',
    '> Regular quote line one.',
    '> Regular quote line two.',
    '',
    '> 💡 Callout body sentinel with a nested paragraph.',
    '> ',
    '> Second callout line sentinel.',
    '',
    '> [!callout-icon:%F0%9F%93%8C] Callout encoded icon sentinel.',
    '> Encoded icon callout body sentinel.',
    '',
    '## Lists',
    '',
    '- Bullet item alpha',
    '- Bullet item beta',
    '  - Nested bullet beta child',
    '+ Plus bullet item sentinel',
    '* Star bullet item sentinel',
    '',
    '1. Ordered item alpha',
    '2. Ordered item beta',
    '',
    'Ordered list separator paragraph sentinel.',
    '',
    '7. Ordered item custom start sentinel',
    '8. Ordered item custom continuation sentinel',
    '',
    '- [ ] Task item unchecked sentinel',
    '- [x] Task item checked sentinel',
    '',
    '## Definition Lists',
    '',
    'Term sentinel',
    ': Definition description sentinel',
    '',
    'Second term sentinel',
    ': Second definition description sentinel',
    '',
    '## Tables',
    '',
    '| Feature | Status | Count |',
    '| :--- | :---: | ---: |',
    '| Table alpha | Stable | 1 |',
    '| Table beta | Covered | 2 |',
    '',
    '## Horizontal Rules',
    '',
    '---',
    '',
    '***',
    '',
    '___',
    '',
    '## Code',
    '',
    '```ts',
    'const syntaxSentinel: string = "code block sentinel";',
    'console.log(syntaxSentinel);',
    '```',
    '',
    '```',
    'plain code block sentinel',
    '```',
    '',
    '## Math',
    '',
    '$$',
    'E = mc^2',
    '$$',
    '',
    'Inline math sentinel $a^2 + b^2 = c^2$ lives in this sentence.',
    '',
    '## Diagrams',
    '',
    '```mermaid',
    'flowchart TD',
    '  Start[E2E Start] --> Done[E2E Done]',
    '```',
    '',
    '## Media',
    '',
    `![Image alt sentinel](${TINY_PNG_DATA_URL} "Image title sentinel")`,
    '',
    `<img src="${TINY_PNG_DATA_URL}" alt="HTML image alt sentinel" width="40%" align="right" title="HTML image title sentinel" data-vlaina-crop="1,2,30,40,1" />`,
    '',
    '![video](https://www.youtube.com/watch?v=dQw4w9WgXcQ "Video title sentinel")',
    '',
    '## Footnotes',
    '',
    'Footnote reference sentinel[^syntax-note].',
    '',
    '[^syntax-note]: Footnote definition sentinel.',
    '',
    '## Alignment',
    '',
    'Centered paragraph sentinel.',
    '<!--align:center-->',
    '',
    '### Right aligned heading sentinel',
    '<!--align:right-->',
    '',
    '## Raw HTML',
    '',
    '<div class="raw-html-sentinel">Raw HTML block sentinel</div>',
    '',
    'Final paragraph sentinel for block selection.',
    '',
  ].join('\n');
}

async function expectEditorContains(page: Page, texts: string[]) {
  for (const text of texts) {
    await expect(page.locator(EDITOR_SELECTOR)).toContainText(text);
  }
}

test.describe('notes markdown syntax rendering', () => {
  test.setTimeout(120_000);

  test('renders supported markdown syntax as Milkdown blocks and keeps block selection usable', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-markdown-syntax');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:')) {
          console.info(text);
        }
      });

      const openMetrics = await openMarkdownFixture(page, {
        filename: 'markdown-syntax-e2e.md',
        content: createMarkdownSyntaxFixture(),
      });
      console.info('[notes-markdown-syntax-open]', openMetrics);

      await expectEditorContains(page, [
        'E2E Markdown Syntax',
        'Heading Level Six Sentinel',
        'Inline marks paragraph',
        'colored text sentinel',
        'background color sentinel',
        'Soft break line one sentinel',
        'hard break line two sentinel',
        'Escaped syntax sentinel',
        'Regular quote line one.',
        'Callout body sentinel',
        'Encoded icon callout body sentinel',
        'Bullet item alpha',
        'Plus bullet item sentinel',
        'Star bullet item sentinel',
        'Ordered item beta',
        'Ordered list separator paragraph sentinel',
        'Ordered item custom start sentinel',
        'Task item unchecked sentinel',
        'Task item checked sentinel',
        'Term sentinel',
        'Definition description sentinel',
        'Second definition description sentinel',
        'Table alpha',
        'code block sentinel',
        'plain code block sentinel',
        'Inline math sentinel',
        'Footnote reference sentinel',
        'Footnote definition sentinel',
        'Centered paragraph sentinel',
        'Right aligned heading sentinel',
        'Raw HTML block sentinel',
        'Final paragraph sentinel',
      ]);

      await expect(page.locator(`${EDITOR_SELECTOR} .frontmatter-block-container`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h1`, { hasText: 'E2E Markdown Syntax' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h2`, { hasText: 'Inline Marks And Links' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h3`, { hasText: 'Heading Level Three Sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h4`, { hasText: 'Heading Level Four Sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h5`, { hasText: 'Heading Level Five Sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h6`, { hasText: 'Heading Level Six Sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="toc"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} blockquote`, { hasText: 'Regular quote line one' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="callout"]`, { hasText: 'Callout body sentinel with a nested paragraph' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="callout"]`, { hasText: 'Encoded icon callout body sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} li[data-item-type="task"][data-checked="false"]`, { hasText: 'Task item unchecked sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} li[data-item-type="task"][data-checked="true"]`, { hasText: 'Task item checked sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} ul > li`, { hasText: 'Plus bullet item sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} ul > li`, { hasText: 'Star bullet item sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} ol[start="7"] > li`, { hasText: 'Ordered item custom start sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR}`, { hasText: 'Term sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR}`, { hasText: 'Definition description sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} table`, { hasText: 'Table alpha' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} th`).first()).toHaveText('Feature');
      await expect(page.locator(`${EDITOR_SELECTOR} .code-block-container`, { hasText: 'syntaxSentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .code-block-container[data-language="ts"]`, { hasText: 'syntaxSentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .code-block-container`, { hasText: 'plain code block sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="math-block"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} span[data-type="math-inline"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="mermaid"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .image-block-container, ${EDITOR_SELECTOR} img.md-image`).first()).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .image-block-container[data-alt="Image alt sentinel"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .image-block-container[data-alt="HTML image alt sentinel"][data-width="40%"][data-align="right"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="video"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} sup.footnote-ref`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div.footnote-def[data-type="footnote_definition"]`, { hasText: 'Footnote definition sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} strong`, { hasText: 'strong text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} strong`, { hasText: 'strong underscore text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} em`, { hasText: 'emphasis text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} em`, { hasText: 'emphasis underscore text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} s, ${EDITOR_SELECTOR} del`, { hasText: 'strike text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} mark`, { hasText: 'highlighted text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} u`, { hasText: 'underlined text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} sup`, { hasText: 'superscript text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} sub`, { hasText: 'subscript text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} code.v-std-code`, { hasText: 'inline code' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} span[data-text-color="#2563eb"]`, { hasText: 'colored text sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} mark[data-bg-color="#fde047"]`, { hasText: 'background color sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} abbr[title="HyperText Markup Language"]`, { hasText: 'HTML' }).first()).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} [data-editor-tag-token="true"]`, { hasText: '#syntax-tag' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} a[href="https://example.com/docs"]`, { hasText: 'explicit link' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} a[href="./linked-note.md#target-heading"]`, { hasText: 'internal note link' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} a.autolink[href="https://www.example.org"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} a.autolink[href="mailto:syntax@example.com"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Hard break line one sentinel' }).locator('br')).toHaveCount(1);
      await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'HTML break line one sentinel' })).toContainText('HTML break line two sentinel');
      await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Escaped syntax sentinel' })).toContainText('# not a heading');
      await expect(page.locator(`${EDITOR_SELECTOR} p[data-text-align="center"]`, { hasText: 'Centered paragraph sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h3[data-text-align="right"]`, { hasText: 'Right aligned heading sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .md-htmlblock, ${EDITOR_SELECTOR} .md-htmlblock-container`, { hasText: 'Raw HTML block sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} [data-type="hr"]`)).toHaveCount(3);

      await expect(page.locator(`${EDITOR_SELECTOR} table th`, { hasText: 'Status' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} table td`, { hasText: 'Covered' })).toBeVisible();

      const metrics = await collectEditorDomMetrics(page);
      console.info('[notes-markdown-syntax-dom]', metrics);
      expect(metrics.countsBySelector.sourceFallback).toBe(0);
      expect(metrics.countsBySelector.headings).toBeGreaterThanOrEqual(14);
      expect(metrics.countsBySelector.blockquotes).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.callouts).toBeGreaterThanOrEqual(2);
      expect(metrics.countsBySelector.bulletItems).toBeGreaterThanOrEqual(5);
      expect(metrics.countsBySelector.orderedItems).toBeGreaterThanOrEqual(4);
      expect(metrics.countsBySelector.taskItems).toBe(2);
      expect(metrics.countsBySelector.tables).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.codeBlocks).toBeGreaterThanOrEqual(2);
      expect(metrics.countsBySelector.frontmatter).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.mathBlocks).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.mathInline).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.mermaid).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.video).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.toc).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.footnoteRefs).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.footnoteDefs).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.images).toBeGreaterThanOrEqual(2);
      expect(metrics.countsBySelector.highlights).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.superscript).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.subscript).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.abbr).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.tags).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.autolinks).toBeGreaterThanOrEqual(2);
      expect(metrics.countsBySelector.explicitLinks).toBeGreaterThanOrEqual(4);
      expect(metrics.countsBySelector.horizontalRules).toBeGreaterThanOrEqual(3);
      expect(metrics.selectableBlockCount).toBeGreaterThan(50);

      const selectableBlocks = await getSelectableBlocks(page);
      expect(selectableBlocks).toEqual(expect.arrayContaining([
        expect.objectContaining({ tagName: 'H1', text: expect.stringContaining('E2E Markdown Syntax') }),
        expect.objectContaining({ text: expect.stringContaining('Inline marks paragraph') }),
        expect.objectContaining({ tagName: 'LI', text: expect.stringContaining('Task item checked sentinel') }),
        expect.objectContaining({ text: expect.stringContaining('Final paragraph sentinel') }),
      ]));

      const selectedCount = await selectNoteBlocksByText(page, [
        'Inline marks paragraph',
        'Task item checked sentinel',
        'Right aligned heading sentinel',
        'Final paragraph sentinel',
      ]);
      expect(selectedCount).toBeGreaterThanOrEqual(4);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR).first()).toBeVisible();

      await scrollNoteToTop(page);
      await scrollElementIntoViewByText(page, SELECTED_BLOCK_SELECTOR, 'Inline marks paragraph');
      const hoveredSelected = page.locator(SELECTED_BLOCK_SELECTOR, { hasText: 'Inline marks paragraph' }).first();
      const selectedRect = await hoveredSelected.boundingBox();
      if (!selectedRect) {
        throw new Error('Could not resolve selected block geometry');
      }
      await page.mouse.move(Math.max(8, selectedRect.x - 18), selectedRect.y + selectedRect.height / 2);
      await expect(page.locator(BLOCK_CONTROLS_SELECTOR)).toBeVisible();

      const handleGeometry = await page.evaluate(() => {
        const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible');
        const selected = Array.from(
          document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror .editor-block-selected')
        ).find((element) => element.textContent?.includes('Inline marks paragraph'));
        if (!controls || !selected) return null;
        const controlsRect = controls.getBoundingClientRect();
        const selectedRect = selected.getBoundingClientRect();
        return {
          controlsCenterY: controlsRect.top + controlsRect.height / 2,
          selectedCenterY: selectedRect.top + selectedRect.height / 2,
          controlsLeft: controlsRect.left,
          selectedLeft: selectedRect.left,
        };
      });
      expect(handleGeometry).not.toBeNull();
      expect(Math.abs(handleGeometry!.controlsCenterY - handleGeometry!.selectedCenterY)).toBeLessThanOrEqual(2);
      expect(handleGeometry!.controlsLeft).toBeLessThan(handleGeometry!.selectedLeft);

      await clearSelectedNoteBlocks(page);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
