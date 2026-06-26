import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openAbsoluteNote,
  openMarkdownFixture,
} from './notesE2E';

const VISIBLE_MARKDOWN_BLANK_LINE_SELECTOR = [
  '[data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"]',
  'p.editor-editable-markdown-blank-line',
  'p:empty',
].join(', ');
const MARKDOWN_BLANK_LINE_SELECTOR =
  '[data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"]';
const TEXTBLOCK_CARET_OVERLAY_SELECTOR = '.editor-textblock-caret-overlay';

function createParagraphGapMarkdown(blankLineCount: number): string {
  return [
    'Blank line audit before',
    ...Array.from({ length: blankLineCount }, () => ''),
    'Blank line audit after',
  ].join('\n');
}

function createMinimalBlankRunMarkdown(blankLineCount: number): string {
  return [
    'h',
    ...Array.from({ length: blankLineCount }, () => ''),
    'i',
  ].join('\n');
}

async function readBlankLineRenderAudit(page: Page): Promise<{
  renderedBlankLineCount: number;
  paragraphTexts: string[];
  noteContent: string;
}> {
  return page.locator(EDITOR_SELECTOR).evaluate((editor, selector) => ({
    renderedBlankLineCount: editor.querySelectorAll(selector).length,
    paragraphTexts: Array.from(editor.querySelectorAll('p')).map((paragraph) =>
      paragraph.textContent ?? ''
    ),
    noteContent: String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? ''),
  }), VISIBLE_MARKDOWN_BLANK_LINE_SELECTOR);
}

async function readTopLevelEditorBlocks(page: Page): Promise<Array<{
  tagName: string;
  text: string;
  isMarkdownBlankLine: boolean;
}>> {
  return page.locator(EDITOR_SELECTOR).evaluate((editor) =>
    Array.from(editor.children).map((child) => ({
      tagName: child.tagName,
      text: child.textContent ?? '',
      isMarkdownBlankLine: child instanceof HTMLElement &&
        child.matches('[data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"]'),
    }))
  );
}

test.describe('notes blank line render audit', () => {
  test.setTimeout(120_000);

  test('renders one visible editor blank line for every user-authored paragraph gap line', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-blank-line-render-audit');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      for (const blankLineCount of [0, 1, 2, 8, 9, 12]) {
        await test.step(`${blankLineCount} user-authored blank lines`, async () => {
          const content = createParagraphGapMarkdown(blankLineCount);
          const opened = await openMarkdownFixture(page, {
            filename: `blank-line-render-audit-${blankLineCount}.md`,
            content,
          });

          const firstOpen = await readBlankLineRenderAudit(page);
          expect(firstOpen, `${blankLineCount} blank lines after first open`).toMatchObject({
            renderedBlankLineCount: blankLineCount,
            noteContent: content,
          });

          await openAbsoluteNote(page, opened.notePath);
          const reopened = await readBlankLineRenderAudit(page);
          expect(reopened, `${blankLineCount} blank lines after reopen`).toMatchObject({
            renderedBlankLineCount: blankLineCount,
            noteContent: content,
          });
        });
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('shows a visible caret overlay after clicking a rendered markdown blank line', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-blank-line-visible-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'blank-line-visible-caret.md',
        content: ['Caret audit before', '', '', 'Caret audit after'].join('\n'),
      });

      const blankLines = page.locator(`${EDITOR_SELECTOR} ${MARKDOWN_BLANK_LINE_SELECTOR}`);
      await expect(blankLines).toHaveCount(2, { timeout: 30_000 });

      const secondBlankLine = blankLines.nth(1);
      const blankLineBox = await secondBlankLine.boundingBox();
      expect(blankLineBox).not.toBeNull();

      await page.mouse.click(
        blankLineBox!.x + Math.max(8, blankLineBox!.width * 0.92),
        blankLineBox!.y + blankLineBox!.height / 2,
      );

      await expect(page.locator(TEXTBLOCK_CARET_OVERLAY_SELECTOR)).toBeVisible({ timeout: 10_000 });
      const caretAudit = await page.evaluate(({ caretSelector, editorSelector }) => {
        const caret = document.querySelector<HTMLElement>(caretSelector);
        const editor = document.querySelector<HTMLElement>(editorSelector);
        const editableBlankLine = editor?.querySelector<HTMLElement>('p.editor-editable-markdown-blank-line');
        const caretRect = caret?.getBoundingClientRect();
        const blankRect = editableBlankLine?.getBoundingClientRect();
        const caretStyle = caret ? getComputedStyle(caret) : null;
        return {
          activeElementClass: document.activeElement?.getAttribute('class') ?? '',
          selectionText: window.getSelection()?.toString() ?? '',
          caretRect: caretRect
            ? { left: caretRect.left, top: caretRect.top, bottom: caretRect.bottom, width: caretRect.width }
            : null,
          blankRect: blankRect
            ? { left: blankRect.left, top: blankRect.top, bottom: blankRect.bottom, width: blankRect.width }
            : null,
          caretOpacity: caretStyle?.opacity ?? null,
          caretDisplay: caretStyle?.display ?? null,
          editableBlankLineText: editableBlankLine?.textContent ?? null,
        };
      }, {
        caretSelector: TEXTBLOCK_CARET_OVERLAY_SELECTOR,
        editorSelector: EDITOR_SELECTOR,
      });

      expect(caretAudit.blankRect, { caretAudit }).not.toBeNull();
      expect(caretAudit.caretRect, { caretAudit }).not.toBeNull();
      expect(caretAudit.editableBlankLineText, { caretAudit }).toBe('\u200B');
      expect(caretAudit.selectionText, { caretAudit }).toBe('');
      expect(caretAudit.caretDisplay, { caretAudit }).not.toBe('none');
      expect(Number(caretAudit.caretOpacity), { caretAudit }).toBeGreaterThan(0);
      expect(caretAudit.caretRect!.bottom, { caretAudit }).toBeGreaterThan(caretAudit.blankRect!.top);
      expect(caretAudit.caretRect!.top, { caretAudit }).toBeLessThan(caretAudit.blankRect!.bottom);

      await page.keyboard.type('Visible caret inserted text');
      const afterType = await readBlankLineRenderAudit(page);
      expect(afterType.paragraphTexts).toContain('Visible caret inserted text');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('allows clicking and typing into the corresponding line for every h/i blank run line', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-long-blank-run-click-type');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const blankLineCount = 10;
      const content = createMinimalBlankRunMarkdown(blankLineCount);

      for (let blankLineIndex = 0; blankLineIndex < blankLineCount; blankLineIndex += 1) {
        await test.step(`blank line ${blankLineIndex + 1}`, async () => {
          await openMarkdownFixture(page, {
            filename: `h-i-blank-run-click-${blankLineIndex + 1}.md`,
            content,
          });

          const blankLines = page.locator(`${EDITOR_SELECTOR} ${MARKDOWN_BLANK_LINE_SELECTOR}`);
          await expect(blankLines).toHaveCount(blankLineCount, { timeout: 30_000 });

          const targetBlankLine = blankLines.nth(blankLineIndex);
          const blankLineBox = await targetBlankLine.boundingBox();
          expect(blankLineBox).not.toBeNull();

          await page.mouse.click(
            blankLineBox!.x + Math.max(8, blankLineBox!.width * 0.88),
            blankLineBox!.y + blankLineBox!.height / 2,
          );

          await expect(page.locator(TEXTBLOCK_CARET_OVERLAY_SELECTOR)).toBeVisible({ timeout: 10_000 });
          const caretRect = await page.locator(TEXTBLOCK_CARET_OVERLAY_SELECTOR).evaluate((caret) => {
            const rect = caret.getBoundingClientRect();
            return {
              top: rect.top,
              bottom: rect.bottom,
            };
          });
          expect(caretRect.bottom, { blankLineIndex, caretRect, blankLineBox }).toBeGreaterThan(blankLineBox!.y);
          expect(caretRect.top, { blankLineIndex, caretRect, blankLineBox })
            .toBeLessThan(blankLineBox!.y + blankLineBox!.height);

          const marker = `inserted blank ${blankLineIndex + 1}`;
          await page.keyboard.type(marker);

          const expectedBlockIndex = blankLineIndex + 1;
          await expect.poll(async () => readTopLevelEditorBlocks(page), {
            message: `Expected typing on blank line ${blankLineIndex + 1} to stay at top-level block ${expectedBlockIndex}`,
            timeout: 10_000,
          }).toEqual(
            Array.from({ length: blankLineCount + 2 }, (_value, blockIndex) => {
              if (blockIndex === 0) {
                return { tagName: 'P', text: 'h', isMarkdownBlankLine: false };
              }
              if (blockIndex === blankLineCount + 1) {
                return { tagName: 'P', text: 'i', isMarkdownBlankLine: false };
              }
              if (blockIndex === expectedBlockIndex) {
                return { tagName: 'P', text: marker, isMarkdownBlankLine: false };
              }
              return { tagName: 'DIV', text: '', isMarkdownBlankLine: true };
            })
          );

          await expect.poll(async () => readBlankLineRenderAudit(page), { timeout: 10_000 })
            .toMatchObject({
              noteContent: expect.stringContaining(marker),
            });
        });
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps caret focus when clicking each h/i blank run line sequentially in one document', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-long-blank-run-sequential-clicks');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const blankLineCount = 10;
      await openMarkdownFixture(page, {
        filename: 'h-i-blank-run-sequential-clicks.md',
        content: createMinimalBlankRunMarkdown(blankLineCount),
      });

      const clickAudit: Array<{
          line: number;
          clickX: number;
          clickY: number;
          targetTag: string | null;
          targetClass: string | null;
          targetValue: string | null;
          selection: unknown;
          caretRect: { top: number; bottom: number; left: number; width: number } | null;
          lineRect: { top: number; bottom: number; left: number; right: number; width: number } | null;
          activeClass: string;
        }> = [];

      for (let line = 0; line < blankLineCount; line += 1) {
        const clickPoint = await page.locator(EDITOR_SELECTOR).evaluate((editor, line) => {
          const blankSelector = '[data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"], p.editor-editable-markdown-blank-line';
          const target = Array.from(editor.querySelectorAll<HTMLElement>(blankSelector))[line];
          if (!target) return null;
          const rect = target.getBoundingClientRect();
          const clickX = rect.left + 16;
          const clickY = rect.top + rect.height / 2;
          const hit = document.elementFromPoint(clickX, clickY) as HTMLElement | null;
          return {
            clickX,
            clickY,
            hitTag: hit?.tagName ?? null,
            hitClass: hit?.getAttribute('class') ?? null,
            hitValue: hit?.getAttribute('data-value') ?? null,
          };
        }, line);

        if (!clickPoint) {
          clickAudit.push(await page.locator(EDITOR_SELECTOR).evaluate((editor, line) => ({
              line,
              clickX: 0,
              clickY: 0,
              targetTag: null,
              targetClass: null,
              targetValue: null,
              selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
              caretRect: null,
              lineRect: null,
              activeClass: document.activeElement?.getAttribute('class') ?? '',
            }), line));
          continue;
        }

        await page.mouse.click(clickPoint.clickX, clickPoint.clickY);

        clickAudit.push(await page.locator(EDITOR_SELECTOR).evaluate((editor, { line, clickPoint }) => {
          const caretSelector = '.editor-textblock-caret-overlay';
          const blankSelector = '[data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"], p.editor-editable-markdown-blank-line';
          const caret = document.querySelector<HTMLElement>(caretSelector);
          const caretRect = caret?.getBoundingClientRect();
          const currentLine = Array.from(editor.querySelectorAll<HTMLElement>(blankSelector))[line];
          const lineRect = currentLine?.getBoundingClientRect();
          return {
            line,
            clickX: clickPoint.clickX,
            clickY: clickPoint.clickY,
            targetTag: clickPoint.hitTag,
            targetClass: clickPoint.hitClass,
            targetValue: clickPoint.hitValue,
            selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
            caretRect: caretRect
              ? { top: caretRect.top, bottom: caretRect.bottom, left: caretRect.left, width: caretRect.width }
              : null,
            lineRect: lineRect
              ? { top: lineRect.top, bottom: lineRect.bottom, left: lineRect.left, right: lineRect.right, width: lineRect.width }
              : null,
            activeClass: document.activeElement?.getAttribute('class') ?? '',
          };
        }, { line, clickPoint }));
      }

      for (const result of clickAudit) {
        expect(result.caretRect, { result }).not.toBeNull();
        expect(result.lineRect, { result }).not.toBeNull();
        expect((result.selection as { empty?: boolean } | null)?.empty, { result }).toBe(true);
        expect(result.caretRect!.bottom, { result }).toBeGreaterThan(result.lineRect!.top);
        expect(result.caretRect!.top, { result }).toBeLessThan(result.lineRect!.bottom);
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('allows clicking visible horizontal blank space across h/i blank run lines', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-long-blank-run-horizontal-clicks');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const blankLineCount = 10;
      const content = createMinimalBlankRunMarkdown(blankLineCount);
      const clickModes = ['left', 'text-start', 'center', 'right'] as const;

      for (const blankLineIndex of [0, 4, 9]) {
        for (const clickMode of clickModes) {
          await test.step(`blank line ${blankLineIndex + 1} ${clickMode}`, async () => {
            await openMarkdownFixture(page, {
              filename: `h-i-horizontal-${blankLineIndex + 1}-${clickMode}.md`,
              content,
            });

            const clickPoint = await page.locator(EDITOR_SELECTOR).evaluate((editor, { blankLineIndex, clickMode }) => {
              const blankLines = Array.from(editor.querySelectorAll<HTMLElement>(
                '[data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"]'
              ));
              const target = blankLines[blankLineIndex];
              if (!target) return null;
              const editorRect = editor.getBoundingClientRect();
              const rect = target.getBoundingClientRect();
              const x = clickMode === 'left'
                ? editorRect.left + 4
                : clickMode === 'text-start'
                  ? rect.left + 16
                  : clickMode === 'center'
                    ? editorRect.left + editorRect.width / 2
                    : editorRect.right - 4;
              return {
                x,
                y: rect.top + rect.height / 2,
                rect: {
                  top: rect.top,
                  bottom: rect.bottom,
                  left: rect.left,
                  right: rect.right,
                  width: rect.width,
                },
                editorRect: {
                  left: editorRect.left,
                  right: editorRect.right,
                  width: editorRect.width,
                },
              };
            }, { blankLineIndex, clickMode });
            expect(clickPoint).not.toBeNull();

            await page.mouse.click(clickPoint!.x, clickPoint!.y);
            await expect(page.locator(TEXTBLOCK_CARET_OVERLAY_SELECTOR)).toBeVisible({ timeout: 10_000 });

            const marker = `horizontal ${clickMode} ${blankLineIndex + 1}`;
            await page.keyboard.type(marker);

            const expectedBlockIndex = blankLineIndex + 1;
            await expect.poll(async () => readTopLevelEditorBlocks(page), {
              message: `Expected ${clickMode} blank-space click on blank line ${blankLineIndex + 1} to type at block ${expectedBlockIndex}`,
              timeout: 10_000,
            }).toEqual(
              Array.from({ length: blankLineCount + 2 }, (_value, blockIndex) => {
                if (blockIndex === 0) {
                  return { tagName: 'P', text: 'h', isMarkdownBlankLine: false };
                }
                if (blockIndex === blankLineCount + 1) {
                  return { tagName: 'P', text: 'i', isMarkdownBlankLine: false };
                }
                if (blockIndex === expectedBlockIndex) {
                  return { tagName: 'P', text: marker, isMarkdownBlankLine: false };
                }
                return { tagName: 'DIV', text: '', isMarkdownBlankLine: true };
              })
            );
          });
        }
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('shows a visible caret overlay after clicking the blank area below the last block', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-tail-blank-visible-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'tail-blank-visible-caret.md',
        content: 'Tail blank click source paragraph',
      });

      const clickPoint = await page.locator(EDITOR_SELECTOR).evaluate((editor) => {
        const lastBlock = editor.lastElementChild as HTMLElement | null;
        const editorRect = editor.getBoundingClientRect();
        const lastRect = lastBlock?.getBoundingClientRect();
        return {
          x: editorRect.left + Math.min(240, Math.max(32, editorRect.width * 0.35)),
          y: (lastRect?.bottom ?? editorRect.top) + 32,
        };
      });

      await page.mouse.click(clickPoint.x, clickPoint.y);

      await expect(page.locator(TEXTBLOCK_CARET_OVERLAY_SELECTOR)).toBeVisible({ timeout: 10_000 });
      const caretAudit = await page.evaluate(({ caretSelector, editorSelector }) => {
        const caret = document.querySelector<HTMLElement>(caretSelector);
        const editor = document.querySelector<HTMLElement>(editorSelector);
        const lastBlock = editor?.lastElementChild as HTMLElement | null;
        const caretRect = caret?.getBoundingClientRect();
        const lastRect = lastBlock?.getBoundingClientRect();
        const caretStyle = caret ? getComputedStyle(caret) : null;
        return {
          activeElementClass: document.activeElement?.getAttribute('class') ?? '',
          selectionText: window.getSelection()?.toString() ?? '',
          lastBlockTag: lastBlock?.tagName ?? null,
          lastBlockText: lastBlock?.textContent ?? null,
          caretRect: caretRect
            ? { left: caretRect.left, top: caretRect.top, bottom: caretRect.bottom, width: caretRect.width }
            : null,
          lastRect: lastRect
            ? { left: lastRect.left, top: lastRect.top, bottom: lastRect.bottom, width: lastRect.width }
            : null,
          caretOpacity: caretStyle?.opacity ?? null,
          caretDisplay: caretStyle?.display ?? null,
        };
      }, {
        caretSelector: TEXTBLOCK_CARET_OVERLAY_SELECTOR,
        editorSelector: EDITOR_SELECTOR,
      });

      expect(caretAudit.caretRect, { caretAudit }).not.toBeNull();
      expect(caretAudit.lastRect, { caretAudit }).not.toBeNull();
      expect(caretAudit.selectionText, { caretAudit }).toBe('');
      expect(caretAudit.caretDisplay, { caretAudit }).not.toBe('none');
      expect(Number(caretAudit.caretOpacity), { caretAudit }).toBeGreaterThan(0);
      expect(caretAudit.caretRect!.bottom, { caretAudit }).toBeGreaterThan(caretAudit.lastRect!.top);
      expect(caretAudit.caretRect!.top, { caretAudit }).toBeLessThan(caretAudit.lastRect!.bottom);

      await page.keyboard.type('Tail blank inserted text');
      const afterType = await readBlankLineRenderAudit(page);
      expect(afterType.paragraphTexts.at(-1)).toBe('Tail blank inserted text');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('shows a visible caret overlay after clicking an editable list blank line gap', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-list-gap-visible-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'list-gap-visible-caret.md',
        content: ['- List gap before', '', '- List gap after'].join('\n'),
      });

      const listGap = page.locator(`${EDITOR_SELECTOR} li.editor-list-gap-placeholder-item`).first();
      await expect(listGap).toBeVisible({ timeout: 30_000 });
      const gapBox = await listGap.boundingBox();
      expect(gapBox).not.toBeNull();

      await page.mouse.click(
        gapBox!.x + Math.max(16, gapBox!.width * 0.7),
        gapBox!.y + gapBox!.height / 2,
      );

      await expect(page.locator(TEXTBLOCK_CARET_OVERLAY_SELECTOR)).toBeVisible({ timeout: 10_000 });
      const caretAudit = await page.evaluate(({ caretSelector, editorSelector }) => {
        const caret = document.querySelector<HTMLElement>(caretSelector);
        const editor = document.querySelector<HTMLElement>(editorSelector);
        const listGapElement = editor?.querySelector<HTMLElement>('li.editor-list-gap-placeholder-item');
        const caretRect = caret?.getBoundingClientRect();
        const gapRect = listGapElement?.getBoundingClientRect();
        const caretStyle = caret ? getComputedStyle(caret) : null;
        const selection = (window as any).__vlainaE2E.getEditorSelectionSummary();
        return {
          activeElementClass: document.activeElement?.getAttribute('class') ?? '',
          selection,
          selectionText: window.getSelection()?.toString() ?? '',
          caretRect: caretRect
            ? { left: caretRect.left, top: caretRect.top, bottom: caretRect.bottom, width: caretRect.width }
            : null,
          gapRect: gapRect
            ? { left: gapRect.left, top: gapRect.top, bottom: gapRect.bottom, width: gapRect.width }
            : null,
          caretOpacity: caretStyle?.opacity ?? null,
          caretDisplay: caretStyle?.display ?? null,
          gapText: listGapElement?.textContent ?? null,
        };
      }, {
        caretSelector: TEXTBLOCK_CARET_OVERLAY_SELECTOR,
        editorSelector: EDITOR_SELECTOR,
      });

      expect(caretAudit.caretRect, { caretAudit }).not.toBeNull();
      expect(caretAudit.gapRect, { caretAudit }).not.toBeNull();
      expect(caretAudit.selection?.empty, { caretAudit }).toBe(true);
      expect(caretAudit.selectionText, { caretAudit }).toBe('');
      expect(caretAudit.caretDisplay, { caretAudit }).not.toBe('none');
      expect(Number(caretAudit.caretOpacity), { caretAudit }).toBeGreaterThan(0);
      expect(caretAudit.caretRect!.bottom, { caretAudit }).toBeGreaterThan(caretAudit.gapRect!.top);
      expect(caretAudit.caretRect!.top, { caretAudit }).toBeLessThan(caretAudit.gapRect!.bottom);

      await page.keyboard.type('List gap inserted text');
      const after = await page.locator(EDITOR_SELECTOR).evaluate((editor) =>
        Array.from(editor.querySelectorAll('li > p')).map((paragraph) =>
          (paragraph.textContent ?? '').replace(/\u2800/g, '').trim()
        )
      );
      expect(after).toContain('List gap inserted text');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('shows a visible caret overlay after clicking an editor-created empty line', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-editor-created-empty-line-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'editor-created-empty-line-caret.md',
        content: '',
      });

      await page.locator(EDITOR_SELECTOR).click({ position: { x: 32, y: 32 } });
      await page.keyboard.type('Editor-created before');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Editor-created after');

      const emptyLinePoint = await page.locator(EDITOR_SELECTOR).evaluate((editor) => {
        const paragraphs = Array.from(editor.querySelectorAll<HTMLElement>('p'));
        const before = paragraphs.find((paragraph) => paragraph.textContent === 'Editor-created before');
        const after = paragraphs.find((paragraph) => paragraph.textContent === 'Editor-created after');
        const beforeRect = before?.getBoundingClientRect();
        const afterRect = after?.getBoundingClientRect();
        return {
          x: (beforeRect?.left ?? editor.getBoundingClientRect().left) + 16,
          y: beforeRect && afterRect
            ? (beforeRect.bottom + afterRect.top) / 2
            : editor.getBoundingClientRect().top + 48,
        };
      });

      await page.mouse.click(emptyLinePoint.x, emptyLinePoint.y);

      await expect(page.locator(TEXTBLOCK_CARET_OVERLAY_SELECTOR)).toBeVisible({ timeout: 10_000 });
      const caretAudit = await page.evaluate(({ caretSelector, editorSelector }) => {
        const caret = document.querySelector<HTMLElement>(caretSelector);
        const editor = document.querySelector<HTMLElement>(editorSelector);
        const emptyParagraph = Array.from(editor?.querySelectorAll<HTMLElement>('p') ?? [])
          .find((paragraph) => (paragraph.textContent ?? '') === '');
        const caretRect = caret?.getBoundingClientRect();
        const emptyRect = emptyParagraph?.getBoundingClientRect();
        const caretStyle = caret ? getComputedStyle(caret) : null;
        const selection = (window as any).__vlainaE2E.getEditorSelectionSummary();
        return {
          activeElementClass: document.activeElement?.getAttribute('class') ?? '',
          selection,
          selectionText: window.getSelection()?.toString() ?? '',
          caretRect: caretRect
            ? { left: caretRect.left, top: caretRect.top, bottom: caretRect.bottom, width: caretRect.width }
            : null,
          emptyRect: emptyRect
            ? { left: emptyRect.left, top: emptyRect.top, bottom: emptyRect.bottom, width: emptyRect.width }
            : null,
          caretOpacity: caretStyle?.opacity ?? null,
          caretDisplay: caretStyle?.display ?? null,
        };
      }, {
        caretSelector: TEXTBLOCK_CARET_OVERLAY_SELECTOR,
        editorSelector: EDITOR_SELECTOR,
      });

      expect(caretAudit.caretRect, { caretAudit }).not.toBeNull();
      expect(caretAudit.emptyRect, { caretAudit }).not.toBeNull();
      expect(caretAudit.selection?.empty, { caretAudit }).toBe(true);
      expect(caretAudit.selectionText, { caretAudit }).toBe('');
      expect(caretAudit.caretDisplay, { caretAudit }).not.toBe('none');
      expect(Number(caretAudit.caretOpacity), { caretAudit }).toBeGreaterThan(0);
      expect(caretAudit.caretRect!.bottom, { caretAudit }).toBeGreaterThanOrEqual(
        caretAudit.emptyRect!.top - 4
      );
      expect(caretAudit.caretRect!.top, { caretAudit }).toBeLessThanOrEqual(
        caretAudit.emptyRect!.bottom + 4
      );

      await page.keyboard.type('Editor-created inserted text');
      const afterType = await readBlankLineRenderAudit(page);
      expect(afterType.paragraphTexts).toContain('Editor-created inserted text');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
