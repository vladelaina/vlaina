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
import { createMarkdownSyntaxFixture } from './notesMarkdownSyntaxFixture';

async function expectEditorContains(page: Page, texts: string[]) {
  for (const text of texts) {
    await expect(page.locator(EDITOR_SELECTOR)).toContainText(text);
  }
}

async function expectParagraphHasHardBreak(page: Page, text: string) {
  await expect.poll(async () => page.evaluate(({ editorSelector, text }) => {
    const paragraphs = Array.from(document.querySelectorAll<HTMLElement>(`${editorSelector} p`));
    return paragraphs.some((paragraph) => paragraph.textContent?.includes(text) && paragraph.querySelector('br'));
  }, { editorSelector: EDITOR_SELECTOR, text })).toBe(true);
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
        'Setext Heading Level One Sentinel',
        'Setext Heading Level Two Sentinel',
        'ATX Closed Heading Sentinel',
        'Heading Level Six Sentinel',
        'Inline marks paragraph',
        'colored text sentinel',
        'background color sentinel',
        'html mark sentinel',
        'html sup sentinel',
        'html sub sentinel',
        'html underline sentinel',
        'rgb colored text sentinel',
        'named background color sentinel',
        'API abbreviation sentinel',
        'Soft break line one sentinel',
        'hard break line two sentinel',
        'backslash hard break line two sentinel',
        'Escaped syntax sentinel',
        'Regular quote line one.',
        'Nested quote bullet sentinel',
        'quoteCodeSentinel',
        'Emoji callout sentinel',
        'Encoded icon callout body sentinel',
        'HTML comment icon callout body sentinel',
        'Bullet item alpha',
        'Third-level bullet sentinel',
        'Plus bullet item sentinel',
        'Star bullet item sentinel',
        'Mixed list parent sentinel',
        'Nested ordered child sentinel',
        'Third-level mixed bullet sentinel',
        'Ordered item beta',
        'Ordered list separator paragraph sentinel',
        'Ordered item custom start sentinel',
        'Task item unchecked sentinel',
        'Task item checked sentinel',
        'Nested task item sentinel',
        'Term sentinel',
        'Definition description sentinel',
        'Second definition description sentinel',
        'Combined definition description sentinel',
        'Table alpha',
        'code block sentinel',
        'plain code block sentinel',
        'indented code block sentinel',
        'Inline math sentinel',
        'Footnote reference sentinel',
        'Footnote definition sentinel',
        'Nested footnote first paragraph sentinel',
        'Nested footnote list item sentinel',
        'Centered paragraph sentinel',
        'Right aligned heading sentinel',
        'Raw HTML block sentinel',
        'Final paragraph sentinel',
      ]);

      await expect(page.locator(`${EDITOR_SELECTOR} .frontmatter-block-container`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h1`, { hasText: 'E2E Markdown Syntax' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h1`, { hasText: 'Setext Heading Level One Sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h2`, { hasText: 'Setext Heading Level Two Sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h2`, { hasText: 'ATX Closed Heading Sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h2`, { hasText: 'Inline Marks And Links' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h3`, { hasText: 'Heading Level Three Sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h4`, { hasText: 'Heading Level Four Sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h5`, { hasText: 'Heading Level Five Sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} h6`, { hasText: 'Heading Level Six Sentinel' })).toBeVisible();
      const tocBlocks = page.locator(`${EDITOR_SELECTOR} div[data-type="toc"]`);
      await expect(tocBlocks).toHaveCount(2);
      await expect(tocBlocks.first()).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} blockquote`, { hasText: 'Regular quote line one' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} blockquote li`, { hasText: 'Nested quote bullet sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} blockquote .code-block-container`, { hasText: 'quoteCodeSentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="callout"]`, { hasText: 'Emoji callout sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="callout"]`, { hasText: 'Encoded icon callout body sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="callout"]`, { hasText: 'HTML comment icon callout body sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} li[data-item-type="task"][data-checked="false"]`, { hasText: 'Task item unchecked sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} li[data-item-type="task"][data-checked="true"]`, { hasText: 'Task item checked sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} li[data-item-type="task"][data-checked="false"]`, { hasText: 'Nested task item sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} ul ul ul > li`, { hasText: 'Third-level bullet sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} ul ol > li`, { hasText: 'Nested ordered child sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} ul ol ul > li`, { hasText: 'Third-level mixed bullet sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} ul > li`, { hasText: 'Plus bullet item sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} ul > li`, { hasText: 'Star bullet item sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} ol[start="7"] > li`, { hasText: 'Ordered item custom start sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR}`, { hasText: 'Term sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR}`, { hasText: 'Definition description sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR}`, { hasText: 'Combined definition description sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} table`, { hasText: 'Table alpha' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} th`).first()).toHaveText('Feature');
      await expect(page.locator(`${EDITOR_SELECTOR} .code-block-container`, { hasText: 'syntaxSentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .code-block-container[data-language="ts"]`, { hasText: 'syntaxSentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .code-block-container`, { hasText: 'plain code block sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .code-block-container`, { hasText: 'indented code block sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="math-block"]`)).toHaveCount(2);
      await expect(page.locator(`${EDITOR_SELECTOR} span[data-type="math-inline"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="mermaid"]`).first()).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="mermaid"]`)).toHaveCount(5);
      await expect(page.locator(`${EDITOR_SELECTOR} .image-block-container, ${EDITOR_SELECTOR} img.md-image`).first()).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .image-block-container[data-alt="Image alt sentinel"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .image-block-container[data-alt="HTML image alt sentinel"][data-width="40%"][data-align="right"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .image-block-container[data-alt="HTML single quote image sentinel"][data-width="50%"][data-align="left"]`)).toHaveCount(1);
      await expect(page.locator(`${EDITOR_SELECTOR} .image-block-container[data-alt="Second markdown image sentinel"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .image-block-container[data-alt="Markdown image escaped < sentinel"]`)).toHaveCount(1);
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="video"]`)).toHaveCount(4);
      await expect(page.locator(`${EDITOR_SELECTOR} sup.footnote-ref`)).toHaveCount(2);
      await expect(page.locator(`${EDITOR_SELECTOR} div.footnote-def[data-type="footnote_definition"]`, { hasText: 'Footnote definition sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div.footnote-def[data-type="footnote_definition"]`, { hasText: 'Nested footnote list item sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} strong`, { hasText: 'strong text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} strong`, { hasText: 'strong underscore text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} em`, { hasText: 'emphasis text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} em`, { hasText: 'emphasis underscore text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} s, ${EDITOR_SELECTOR} del`, { hasText: 'strike text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} mark`, { hasText: 'highlighted text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} mark`, { hasText: 'html mark sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} u`, { hasText: 'underlined text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} u`, { hasText: 'html underline sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} sup`, { hasText: 'superscript text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} sup`, { hasText: 'html sup sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} sub`, { hasText: 'subscript text' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} sub`, { hasText: 'html sub sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} code.v-std-code`, { hasText: 'inline code' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} span[data-text-color="#2563eb"]`, { hasText: 'colored text sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} mark[data-bg-color="#fde047"]`, { hasText: 'background color sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} span[data-text-color="rgb(37, 99, 235)"]`, { hasText: 'rgb colored text sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} mark[data-bg-color="yellow"]`, { hasText: 'named background color sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} abbr[title="HyperText Markup Language"]`, { hasText: 'HTML' }).first()).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} abbr[title="Application Programming Interface"]`, { hasText: 'API' }).first()).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} [data-editor-tag-token="true"]`, { hasText: '#syntax-tag' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} a[href="https://example.com/docs"]`, { hasText: 'explicit link' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} a[href="https://example.com/reference"]`, { hasText: 'reference docs link' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} a[href="./linked-note.md#target-heading"]`, { hasText: 'internal note link' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} a.autolink[href="https://example.com/autolink-angle"]`, { hasText: 'https://example.com/autolink-angle' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} a.autolink[href="https://www.example.org"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} a.autolink[href="mailto:syntax@example.com"]`)).toBeVisible();
      await expectParagraphHasHardBreak(page, 'Hard break line one sentinel');
      await expectParagraphHasHardBreak(page, 'Backslash hard break line one sentinel');
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
      expect(metrics.countsBySelector.callouts).toBeGreaterThanOrEqual(3);
      expect(metrics.countsBySelector.bulletItems).toBeGreaterThanOrEqual(9);
      expect(metrics.countsBySelector.orderedItems).toBeGreaterThanOrEqual(5);
      expect(metrics.countsBySelector.taskItems).toBe(3);
      expect(metrics.countsBySelector.tables).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.codeBlocks).toBeGreaterThanOrEqual(3);
      expect(metrics.countsBySelector.frontmatter).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.mathBlocks).toBeGreaterThanOrEqual(2);
      expect(metrics.countsBySelector.mathInline).toBeGreaterThanOrEqual(1);
      expect(metrics.countsBySelector.mermaid).toBeGreaterThanOrEqual(5);
      expect(metrics.countsBySelector.video).toBeGreaterThanOrEqual(4);
      expect(metrics.countsBySelector.toc).toBeGreaterThanOrEqual(2);
      expect(metrics.countsBySelector.footnoteRefs).toBeGreaterThanOrEqual(2);
      expect(metrics.countsBySelector.footnoteDefs).toBeGreaterThanOrEqual(2);
      expect(metrics.countsBySelector.images).toBeGreaterThanOrEqual(5);
      expect(metrics.countsBySelector.highlights).toBeGreaterThanOrEqual(2);
      expect(metrics.countsBySelector.superscript).toBeGreaterThanOrEqual(2);
      expect(metrics.countsBySelector.subscript).toBeGreaterThanOrEqual(2);
      expect(metrics.countsBySelector.abbr).toBeGreaterThanOrEqual(2);
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
