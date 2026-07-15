import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';
import { createMarkdownSyntaxRoundtripCases } from './notesMarkdownSyntaxFixture';

type BlockGeometry = {
  className: string;
  height: number;
  tagName: string;
  text: string;
  top: number;
};

const CASE_GROUPS = [
  ['frontmatter', 'headings-and-toc', 'inline-marks-and-links', 'paragraphs-and-breaks', 'blockquotes-and-callouts'],
  ['lists', 'definition-lists', 'tables', 'horizontal-rules', 'code-blocks'],
  ['math', 'diagrams', 'media', 'footnotes', 'alignment-and-html'],
] as const;

const INLINE_SELECTION_TEXTS: Partial<Record<string, string[]>> = {
  'headings-and-toc': ['ATX Heading Sentinel', 'Setext Heading Level One Sentinel', 'Level Six Sentinel'],
  'inline-marks-and-links': [
    'strong',
    'emphasis',
    'strike',
    'highlight',
    'underline',
    'sup',
    'sub',
    'code',
    'explicit',
    'autolink',
    'colored text sentinel',
    'background sentinel',
    'API',
  ],
  'paragraphs-and-breaks': ['Soft break line one sentinel', 'Hard break line one sentinel', 'Backslash hard break line one sentinel'],
  'blockquotes-and-callouts': ['Regular quote line one', 'Nested quote bullet sentinel', 'Encoded icon callout body sentinel'],
  lists: ['Bullet item alpha', 'Nested bullet beta child', 'Ordered item beta', 'Task item unchecked sentinel'],
  'definition-lists': ['Term sentinel', 'Definition description sentinel'],
  tables: ['Table alpha', 'Bold table sentinel', 'table link'],
  'code-blocks': ['indented code block sentinel'],
  math: ['Advanced inline math sentinel', 'Inline math sentinel'],
  footnotes: ['Footnote reference sentinel', 'Footnote definition sentinel'],
  'alignment-and-html': ['Centered paragraph sentinel', 'Right aligned heading sentinel', 'Inline raw HTML sentinel'],
};

const BLANK_LINE_SELECTOR = [
  `${EDITOR_SELECTOR} > [data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"]`,
  `${EDITOR_SELECTOR} > [data-type="html-block"][data-value="<!--vlaina-rendered-html-boundary-blank-line-->"]`,
  `${EDITOR_SELECTOR} > p.editor-editable-markdown-blank-line`,
  `${EDITOR_SELECTOR} > p.editor-empty-paragraph:not(.is-editor-empty)`,
  `${EDITOR_SELECTOR} .editor-list-gap-placeholder-item`,
].join(', ');

async function captureBlockGeometry(page: Page): Promise<BlockGeometry[]> {
  return page.evaluate((editorSelector) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) return [];

    const editorRect = editor.getBoundingClientRect();
    return Array.from(editor.children)
      .filter((element) => {
        const value = element.getAttribute('data-value');
        const className = element.className;
        return value !== '<!--vlaina-markdown-blank-line-->'
          && value !== '<!--vlaina-rendered-html-boundary-blank-line-->'
          && !className.includes('editor-editable-markdown-blank-line')
          && !className.includes('editor-empty-paragraph')
          && !className.includes('editor-list-gap-placeholder-item');
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          className: element.className,
          height: rect.height,
          tagName: element.tagName,
          text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
          top: rect.top - editorRect.top,
        };
      });
  }, EDITOR_SELECTOR);
}

async function waitForAsyncLayout(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const imageBlocks = page.locator(`${EDITOR_SELECTOR} .image-block-container`);
  const imageCount = await imageBlocks.count();
  for (let index = 0; index < imageCount; index += 1) {
    const imageBlock = imageBlocks.nth(index);
    await imageBlock.scrollIntoViewIfNeeded();
    await expect.poll(async () => imageBlock.evaluate((element) => {
      if (element.querySelector('[data-testid="deferred-image-placeholder"], .animate-spin')) return false;
      const images = Array.from(element.querySelectorAll('img'));
      return images.length === 0 || images.every((image) => image.complete);
    }), { timeout: 20_000 }).toBe(true);
  }
  const mermaidBlocks = page.locator(`${EDITOR_SELECTOR} .mermaid-block`);
  const mermaidCount = await mermaidBlocks.count();
  for (let index = 0; index < mermaidCount; index += 1) {
    const mermaidBlock = mermaidBlocks.nth(index);
    await mermaidBlock.scrollIntoViewIfNeeded();
    await expect.poll(async () => mermaidBlock.evaluate((element) => (
      !element.querySelector('.mermaid-placeholder')
      && Boolean(element.querySelector('svg, .mermaid-error, .mermaid-empty'))
    )), { timeout: 20_000 }).toBe(true);
  }
  await waitForEditorAnimationFrame(page);
}

function expectStableGeometry(
  before: BlockGeometry[],
  after: BlockGeometry[],
  context: string,
): void {
  expect(after.length, `${context}: selectable block count`).toBe(before.length);

  for (const [index, baseline] of before.entries()) {
    const current = after[index];
    expect(current?.tagName, `${context}: block ${index} tag`).toBe(baseline.tagName);
    for (const property of ['height', 'top'] as const) {
      expect(
        Math.abs(current[property] - baseline[property]),
        `${context}: ${baseline.tagName}.${baseline.className} "${baseline.text}" ${property} ${baseline[property]} -> ${current[property]}`,
      ).toBeLessThanOrEqual(0.5);
    }
  }
}

async function auditBlockSelections(page: Page, label: string): Promise<void> {
  const initial = await captureBlockGeometry(page);
  expect(initial.length, `${label}: content blocks`).toBeGreaterThan(0);
  const selectableCount = await page.evaluate(() => (window as any).__vlainaE2E.getNoteSelectableBlocks().length);

  for (let index = 0; index < selectableCount; index += 1) {
    await page.evaluate(() => (window as any).__vlainaE2E.selectNoteBlocksByIndexes([]));
    await waitForEditorAnimationFrame(page);
    const baseline = await captureBlockGeometry(page);
    const selectedCount = await page.evaluate(
      (targetIndex) => (window as any).__vlainaE2E.selectNoteBlocksByIndexes([targetIndex]),
      index,
    );
    expect(selectedCount, `${label}: select block ${index}`).toBe(1);
    await waitForEditorAnimationFrame(page);
    expectStableGeometry(baseline, await captureBlockGeometry(page), `${label}: block ${index}`);
  }

  await page.evaluate(() => (window as any).__vlainaE2E.selectNoteBlocksByIndexes([]));
}

async function auditInlineSelections(page: Page, label: string): Promise<void> {
  for (const text of INLINE_SELECTION_TEXTS[label] ?? []) {
    const baseline = await captureBlockGeometry(page);
    const result = await page.evaluate(
      (targetText) => (window as any).__vlainaE2E.selectEditorTextByText(targetText),
      text,
    );
    expect(result.selected, `${label}: select text "${text}"`).toBe(true);
    await waitForEditorAnimationFrame(page);
    expectStableGeometry(baseline, await captureBlockGeometry(page), `${label}: text "${text}"`);
  }
}

async function auditBlankLineClicks(page: Page, label: string): Promise<void> {
  const blankLines = page.locator(BLANK_LINE_SELECTOR);
  const count = await blankLines.count();

  for (let index = 0; index < count; index += 1) {
    const blankLine = blankLines.nth(index);
    await blankLine.scrollIntoViewIfNeeded();
    await waitForEditorAnimationFrame(page);
    const baseline = await captureBlockGeometry(page);
    const box = await blankLine.boundingBox();
    expect(box, `${label}: blank line ${index}`).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await waitForEditorAnimationFrame(page);
    expectStableGeometry(baseline, await captureBlockGeometry(page), `${label}: blank line ${index}`);
  }
}

test.describe('notes markdown syntax layout audit', () => {
  test.setTimeout(300_000);

  for (const [groupIndex, labels] of CASE_GROUPS.entries()) {
    test(`keeps syntax group ${groupIndex + 1} stable across editor interaction states`, async () => {
      const { app, userDataRoot } = await launchIsolatedElectron(`notes-markdown-layout-audit-${groupIndex + 1}`);

      try {
        await app.firstWindow();
        const [page] = await getOpenBridgePages(app, 1);
        await page.setViewportSize({ width: 1280, height: 860 });
        const cases = createMarkdownSyntaxRoundtripCases()
          .filter((syntaxCase) => (labels as readonly string[]).includes(syntaxCase.label));
        expect(cases.map((syntaxCase) => syntaxCase.label)).toEqual([...labels]);

        for (const syntaxCase of cases) {
          await openMarkdownFixture(page, {
            filename: `markdown-layout-audit-${syntaxCase.label}.md`,
            content: syntaxCase.markdown,
          });
          await waitForAsyncLayout(page);
          await auditBlockSelections(page, syntaxCase.label);
          await auditInlineSelections(page, syntaxCase.label);
          await auditBlankLineClicks(page, syntaxCase.label);
        }
      } finally {
        await cleanupIsolatedElectron(app, userDataRoot);
      }
    });
  }
});
