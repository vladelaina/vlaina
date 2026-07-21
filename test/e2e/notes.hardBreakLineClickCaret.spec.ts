import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

const HARD_BREAK_LINES = [
  'Hard break first line target',
  'Hard break middle line target',
  'Hard break final line target',
] as const;

const NESTED_HARD_BREAK_CASES = [
  {
    label: 'bullet list first line',
    lineText: 'Nested bullet first line target',
    content: [
      '- Nested bullet first line target  ',
      '  Nested bullet second line target  ',
      '  Nested bullet final line target',
    ].join('\n'),
  },
  {
    label: 'bullet list middle line',
    lineText: 'Nested bullet second line target',
    content: [
      '- Nested bullet first line target  ',
      '  Nested bullet second line target  ',
      '  Nested bullet final line target',
    ].join('\n'),
  },
  {
    label: 'blockquote first line',
    lineText: 'Nested quote first line target',
    content: [
      '> Nested quote first line target  ',
      '> Nested quote second line target  ',
      '> Nested quote final line target',
    ].join('\n'),
  },
] as const;

function createFixtureContent(): string {
  return [
    '# Hard break line click caret',
    '',
    ...HARD_BREAK_LINES,
    '',
    'Following paragraph must stay unchanged.',
  ].join('\n');
}

async function getTrailingClickTarget(page: Page, lineText: string, isFinalLine: boolean) {
  return page.evaluate(({ editorSelector, lineText, isFinalLine }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) throw new Error('Missing editor');
    const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks() as Array<{
      from: number;
      to: number;
      rangeText: string;
    }>;
    const block = blocks.find((candidate) => candidate.rangeText === lineText);
    if (!block) throw new Error(`Missing selectable line: ${lineText}`);

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let textNode: Text | null = null;
    while (walker.nextNode()) {
      const candidate = walker.currentNode as Text;
      if (candidate.data === lineText) {
        textNode = candidate;
        break;
      }
    }
    if (!textNode) throw new Error(`Missing text node: ${lineText}`);

    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rect = range.getBoundingClientRect();
    range.detach();
    const editorRect = editor.getBoundingClientRect();
    const x = Math.min(editorRect.right - 8, rect.right + 80);
    if (x < rect.right + 52) {
      throw new Error(`Insufficient trailing click space for: ${lineText}`);
    }

    return {
      point: { x, y: rect.top + rect.height / 2 },
      expectedPos: isFinalLine ? block.to : block.to - 1,
    };
  }, { editorSelector: EDITOR_SELECTOR, lineText, isFinalLine });
}

async function getNestedTrailingClickTarget(page: Page, lineText: string) {
  const textRange = await page.evaluate((text) => (
    (window as any).__vlainaE2E.getEditorTextRange(text)
  ), lineText) as { from: number; to: number } | null;
  expect(textRange, lineText).not.toBeNull();

  return page.evaluate(({ editorSelector, expectedPos, lineText }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) throw new Error('Missing editor');

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let textNode: Text | null = null;
    let textOffset = -1;
    while (walker.nextNode()) {
      const candidate = walker.currentNode as Text;
      const candidateOffset = candidate.data.indexOf(lineText);
      if (candidateOffset < 0) continue;
      textNode = candidate;
      textOffset = candidateOffset;
      break;
    }
    if (!textNode) throw new Error(`Missing nested text node: ${lineText}`);

    const range = document.createRange();
    range.setStart(textNode, textOffset);
    range.setEnd(textNode, textOffset + lineText.length);
    const rect = range.getBoundingClientRect();
    range.detach();
    const editorRect = editor.getBoundingClientRect();
    const x = Math.min(editorRect.right - 8, rect.right + 80);
    if (x < rect.right + 52) {
      throw new Error(`Insufficient nested trailing click space for: ${lineText}`);
    }

    return {
      point: { x, y: rect.top + rect.height / 2 },
      expectedPos,
    };
  }, { editorSelector: EDITOR_SELECTOR, expectedPos: textRange!.to, lineText });
}

test.describe('notes hard-break line click caret', () => {
  test.setTimeout(90_000);

  test('keeps trailing blank clicks at exact first, middle, and final line ends', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-hard-break-line-click-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 945, height: 1036 });

      for (let index = 0; index < HARD_BREAK_LINES.length; index += 1) {
        const lineText = HARD_BREAK_LINES[index];
        const isFinalLine = index === HARD_BREAK_LINES.length - 1;
        await test.step(lineText, async () => {
          await openMarkdownFixture(page, {
            filename: `hard-break-line-click-${index + 1}.md`,
            content: createFixtureContent(),
          });
          const target = await getTrailingClickTarget(page, lineText, isFinalLine);

          const focused = await page.evaluate(({ x, y }) => (
            (window as any).__vlainaE2E.focusEditorAtPoint(x, y)
          ), target.point);
          expect(focused, { lineText, target }).toBe(true);
          const focusedSelection = await page.evaluate(() => (
            (window as any).__vlainaE2E.getEditorSelectionSummary()
          ));
          expect(focusedSelection, { lineText, target }).toMatchObject({
            empty: true,
            from: target.expectedPos,
            to: target.expectedPos,
          });

          await page.mouse.click(target.point.x, target.point.y);
          await waitForEditorAnimationFrame(page);
          const selection = await page.evaluate(() => (
            (window as any).__vlainaE2E.getEditorSelectionSummary()
          ));

          expect(selection, { lineText, target }).toMatchObject({
            empty: true,
            from: target.expectedPos,
            to: target.expectedPos,
          });

          if (isFinalLine) {
            await page.keyboard.press('Enter');
            await waitForEditorAnimationFrame(page);
            const afterEnter = await page.evaluate(() => (
              (window as any).__vlainaE2E.getEditorSelectionSummary()
            ));
            expect(afterEnter, { lineText, target }).toMatchObject({
              empty: true,
              from: target.expectedPos + 2,
              to: target.expectedPos + 2,
            });
            await expect(page.locator(`${EDITOR_SELECTOR} p`).filter({ hasText: lineText }))
              .toContainText(lineText);
          }
        });
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps nested list and blockquote hard-break clicks at the clicked line end', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-nested-hard-break-line-click-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 945, height: 1036 });

      for (let index = 0; index < NESTED_HARD_BREAK_CASES.length; index += 1) {
        const scenario = NESTED_HARD_BREAK_CASES[index];
        await test.step(scenario.label, async () => {
          await openMarkdownFixture(page, {
            filename: `nested-hard-break-line-click-${index + 1}.md`,
            content: [
              '# Nested hard break line click caret',
              '',
              scenario.content,
              '',
              'Nested following paragraph must stay unchanged.',
            ].join('\n'),
          });
          const target = await getNestedTrailingClickTarget(page, scenario.lineText);

          const focused = await page.evaluate(({ x, y }) => (
            (window as any).__vlainaE2E.focusEditorAtPoint(x, y)
          ), target.point);
          expect(focused, { scenario, target }).toBe(true);
          const focusedSelection = await page.evaluate(() => (
            (window as any).__vlainaE2E.getEditorSelectionSummary()
          ));
          expect(focusedSelection, { scenario, target }).toMatchObject({
            empty: true,
            from: target.expectedPos,
            to: target.expectedPos,
          });

          await page.mouse.click(target.point.x, target.point.y);
          await waitForEditorAnimationFrame(page);
          const selection = await page.evaluate(() => (
            (window as any).__vlainaE2E.getEditorSelectionSummary()
          ));

          expect(selection, { scenario, target }).toMatchObject({
            empty: true,
            from: target.expectedPos,
            to: target.expectedPos,
          });
        });
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps a selected-text click race on the empty line between consecutive hard breaks', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-consecutive-hard-break-click-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 945, height: 1036 });
      const firstLine = 'Consecutive hard break first line';
      const finalLine = 'Consecutive hard break final line';
      const selectedSentinel = 'Consecutive hard break selection sentinel';

      await openMarkdownFixture(page, {
        filename: 'consecutive-hard-break-click-caret.md',
        content: [
          '# Consecutive hard break click caret',
          '',
          `${firstLine}${finalLine}`,
          '',
          selectedSentinel,
        ].join('\n'),
      });
      const firstRange = await page.evaluate((text) => (
        (window as any).__vlainaE2E.getEditorTextRange(text)
      ), firstLine) as { from: number; to: number } | null;
      expect(firstRange).not.toBeNull();
      await page.evaluate((pos) => (
        (window as any).__vlainaE2E.setEditorSelectionRange(pos)
      ), firstRange!.to);
      await page.keyboard.press('Shift+Enter');
      await page.keyboard.press('Shift+Enter');
      await waitForEditorAnimationFrame(page);

      const target = await page.evaluate(({ editorSelector, firstLine, finalLine }) => {
        const editor = document.querySelector<HTMLElement>(editorSelector);
        if (!editor) throw new Error('Missing editor');
        const paragraph = Array.from(editor.querySelectorAll<HTMLElement>('p'))
          .find((candidate) => {
            const text = candidate.textContent ?? '';
            return text.includes(firstLine) && text.includes(finalLine);
          }) ?? null;
        const breaks = paragraph ? Array.from(paragraph.querySelectorAll('br')) : [];
        if (!paragraph || breaks.length < 2) {
          throw new Error(`Missing consecutive hard breaks: ${breaks.length}`);
        }
        const emptyLineRect = breaks[1]!.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        return {
          x: editorRect.right - 8,
          y: emptyLineRect.top + Math.max(1, emptyLineRect.height / 2),
          breakCount: breaks.length,
        };
      }, { editorSelector: EDITOR_SELECTOR, firstLine, finalLine });
      expect(target.breakCount).toBe(2);
      const expectedPos = firstRange!.to + 1;

      const focused = await page.evaluate(({ x, y }) => (
        (window as any).__vlainaE2E.focusEditorAtPoint(x, y)
      ), target);
      expect(focused).toBe(true);
      await expect.poll(async () => page.evaluate(() => (
        (window as any).__vlainaE2E.getEditorSelectionSummary()
      ))).toMatchObject({ empty: true, from: expectedPos, to: expectedPos });

      const selected = await page.evaluate((text) => (
        (window as any).__vlainaE2E.selectEditorTextByText(text)
      ), selectedSentinel) as { selected: boolean };
      expect(selected.selected).toBe(true);
      await page.mouse.click(target.x, target.y);
      await waitForEditorAnimationFrame(page);
      await waitForEditorAnimationFrame(page);
      await expect.poll(async () => page.evaluate(() => (
        (window as any).__vlainaE2E.getEditorSelectionSummary()
      ))).toMatchObject({ empty: true, from: expectedPos, to: expectedPos });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
