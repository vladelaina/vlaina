import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

const BLANK_LINE_SELECTOR = [
  `${EDITOR_SELECTOR} [data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"]`,
  `${EDITOR_SELECTOR} p.editor-editable-markdown-blank-line`,
  `${EDITOR_SELECTOR} p:empty`,
].join(', ');

async function setCursorAtTextStart(page: Page, text: string): Promise<{ from: number; to: number }> {
  const selected = await page.evaluate((targetText) =>
    (window as any).__vlainaE2E.selectEditorTextByText(targetText, targetText), text
  );
  expect(selected, `Expected to select "${text}"`).toMatchObject({
    selected: true,
    selectedText: text,
  });

  const selection = await page.evaluate((position) =>
    (window as any).__vlainaE2E.setEditorSelectionRange(position), selected.from
  );
  expect(selection).toMatchObject({
    empty: true,
    from: selected.from,
    to: selected.from,
  });
  await waitForEditorAnimationFrame(page);

  return {
    from: selected.from,
    to: selected.to,
  };
}

async function selectText(page: Page, text: string): Promise<{ from: number; to: number }> {
  const selected = await page.evaluate((targetText) =>
    (window as any).__vlainaE2E.selectEditorTextByText(targetText, targetText), text
  );
  expect(selected, `Expected to select "${text}"`).toMatchObject({
    selected: true,
    selectedText: text,
  });
  await waitForEditorAnimationFrame(page);

  return {
    from: selected.from,
    to: selected.to,
  };
}

async function setCursorAtTextEnd(page: Page, text: string): Promise<{ from: number; to: number }> {
  const range = await selectText(page, text);
  const selection = await page.evaluate((position) =>
    (window as any).__vlainaE2E.setEditorSelectionRange(position), range.to
  );
  expect(selection).toMatchObject({
    empty: true,
    from: range.to,
    to: range.to,
  });
  await waitForEditorAnimationFrame(page);

  return range;
}

async function clickFirstBlankLine(page: Page) {
  const blankLine = page.locator(BLANK_LINE_SELECTOR).first();
  await expect(blankLine).toBeVisible({ timeout: 30_000 });
  await blankLine.scrollIntoViewIfNeeded();
  const box = await blankLine.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await waitForEditorAnimationFrame(page);
}

async function collectSelectionDiagnostics(page: Page) {
  return page.evaluate(({ blankLineSelector, editorSelector }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const selection = (window as any).__vlainaE2E.getEditorSelectionSummary();
    const browserSelection = window.getSelection();
    const activeElement = document.activeElement;
    return {
      activeElementClassName: activeElement instanceof HTMLElement ? activeElement.className : null,
      browserSelection: {
        anchorNodeName: browserSelection?.anchorNode
          ? (browserSelection.anchorNode.nodeType === Node.TEXT_NODE
            ? '#text'
            : (browserSelection.anchorNode as Element).nodeName)
          : null,
        anchorOffset: browserSelection?.anchorOffset ?? null,
        focusOffset: browserSelection?.focusOffset ?? null,
      },
      blankLineCount: document.querySelectorAll(blankLineSelector).length,
      editorText: editor?.textContent ?? '',
      html: editor?.innerHTML ?? '',
      selection,
    };
  }, {
    blankLineSelector: BLANK_LINE_SELECTOR,
    editorSelector: EDITOR_SELECTOR,
  });
}

test.describe('notes heading hard-break Delete caret', () => {
  test.setTimeout(90_000);

  const cases = [
    {
      label: 'Delete from before the line text',
      deleteLineText: async (page: Page) => {
        await setCursorAtTextStart(page, '2');
        await page.keyboard.press('Delete');
      },
    },
    {
      label: 'Backspace from after the line text',
      deleteLineText: async (page: Page) => {
        await setCursorAtTextEnd(page, '2');
        await page.keyboard.press('Backspace');
      },
    },
    {
      label: 'Delete selected line text',
      deleteLineText: async (page: Page) => {
        await selectText(page, '2');
        await page.keyboard.press('Delete');
      },
    },
  ];

  test('moves directly to the heading end after deleting next line text and pressing Delete', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-heading-hard-break-delete-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      for (const testCase of cases) {
        await openMarkdownFixture(page, {
          filename: `heading-hard-break-delete-caret-${testCase.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`,
          content: ['# 1', '2', '3'].join('\n'),
        });
        await expect(page.locator(EDITOR_SELECTOR)).toContainText('1');
        await expect(page.locator(EDITOR_SELECTOR)).toContainText('2');
        await expect(page.locator(EDITOR_SELECTOR)).toContainText('3');

        const headingRange = await setCursorAtTextStart(page, '1');

        await testCase.deleteLineText(page);
        await waitForEditorAnimationFrame(page);
        const afterDeletingTwo = await collectSelectionDiagnostics(page);
        expect(afterDeletingTwo.selection, JSON.stringify(afterDeletingTwo, null, 2)).toMatchObject({
          empty: true,
        });

        await page.keyboard.press('Delete');
        await waitForEditorAnimationFrame(page);
        const afterDeletingBreak = await collectSelectionDiagnostics(page);

        expect(afterDeletingBreak.editorText).toContain('13');
        expect(afterDeletingBreak.selection, `${testCase.label}\n${JSON.stringify(afterDeletingBreak, null, 2)}`).toMatchObject({
          empty: true,
          from: headingRange.to,
          to: headingRange.to,
        });
        expect(afterDeletingBreak.browserSelection, `${testCase.label}\n${JSON.stringify(afterDeletingBreak, null, 2)}`).toMatchObject({
          anchorNodeName: '#text',
          anchorOffset: '1'.length,
          focusOffset: '1'.length,
        });
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps the cursor at the heading end when Delete removes the blank line below it', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-heading-blank-line-delete-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await openMarkdownFixture(page, {
        filename: 'heading-blank-line-delete-caret.md',
        content: ['# 1', '', '3'].join('\n'),
      });
      await expect(page.locator(BLANK_LINE_SELECTOR)).toHaveCount(1);

      const headingRange = await setCursorAtTextEnd(page, '1');

      await page.keyboard.press('Delete');
      await waitForEditorAnimationFrame(page);
      const afterDeletingBlankLine = await collectSelectionDiagnostics(page);

      await expect(page.locator(BLANK_LINE_SELECTOR)).toHaveCount(0);
      expect(afterDeletingBlankLine.selection, JSON.stringify(afterDeletingBlankLine, null, 2)).toMatchObject({
        empty: true,
        from: headingRange.to,
        to: headingRange.to,
      });
      expect(
        ['#text', 'H1'].includes(afterDeletingBlankLine.browserSelection.anchorNodeName),
        JSON.stringify(afterDeletingBlankLine, null, 2),
      ).toBe(true);
      expect(afterDeletingBlankLine.browserSelection.anchorOffset, JSON.stringify(afterDeletingBlankLine, null, 2))
        .toBeGreaterThanOrEqual('1'.length);
      expect(afterDeletingBlankLine.browserSelection.focusOffset, JSON.stringify(afterDeletingBlankLine, null, 2))
        .toBe(afterDeletingBlankLine.browserSelection.anchorOffset);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps the cursor at the heading end when Backspace or Delete starts in the blank line below it', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-heading-focused-blank-line-delete-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      for (const key of ['Backspace', 'Delete'] as const) {
        await openMarkdownFixture(page, {
          filename: `heading-focused-blank-line-${key.toLowerCase()}-caret.md`,
          content: ['# 1', '', '3'].join('\n'),
        });
        await expect(page.locator(BLANK_LINE_SELECTOR)).toHaveCount(1);

        const headingRange = await setCursorAtTextEnd(page, '1');
        await clickFirstBlankLine(page);
        const afterClick = await collectSelectionDiagnostics(page);
        expect(afterClick.selection, `${key}\n${JSON.stringify(afterClick, null, 2)}`).toMatchObject({
          empty: true,
        });

        await page.keyboard.press(key);
        await waitForEditorAnimationFrame(page);
        await expect.poll(
          async () => (await collectSelectionDiagnostics(page)).blankLineCount,
          { message: `${key} should delete the focused blank line below the heading` },
        ).toBe(0);
        const afterDeletingBlankLine = await collectSelectionDiagnostics(page);

        expect(afterDeletingBlankLine.editorText).toContain('13');
        expect(afterDeletingBlankLine.selection, `${key}\n${JSON.stringify(afterDeletingBlankLine, null, 2)}`).toMatchObject({
          empty: true,
          from: headingRange.to,
          to: headingRange.to,
        });
        expect(
          ['#text', 'H1'].includes(afterDeletingBlankLine.browserSelection.anchorNodeName),
          `${key}\n${JSON.stringify(afterDeletingBlankLine, null, 2)}`,
        ).toBe(true);
        expect(afterDeletingBlankLine.browserSelection.focusOffset, `${key}\n${JSON.stringify(afterDeletingBlankLine, null, 2)}`)
          .toBe(afterDeletingBlankLine.browserSelection.anchorOffset);
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps the cursor at the heading end when Delete removes the empty line created by Enter', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-heading-enter-delete-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await openMarkdownFixture(page, {
        filename: 'heading-enter-delete-caret.md',
        content: '# 1',
      });

      const headingRange = await setCursorAtTextEnd(page, '1');
      await page.keyboard.press('Enter');
      await waitForEditorAnimationFrame(page);
      const afterEnter = await collectSelectionDiagnostics(page);
      expect(afterEnter.selection, JSON.stringify(afterEnter, null, 2)).toMatchObject({
        empty: true,
      });

      await page.keyboard.press('Delete');
      await waitForEditorAnimationFrame(page);
      const afterDeletingBlankLine = await collectSelectionDiagnostics(page);

      expect(afterDeletingBlankLine.html, JSON.stringify(afterDeletingBlankLine, null, 2)).not.toContain('<p');
      expect(afterDeletingBlankLine.selection, JSON.stringify(afterDeletingBlankLine, null, 2)).toMatchObject({
        empty: true,
        from: headingRange.to,
        to: headingRange.to,
      });
      expect(
        ['#text', 'H1'].includes(afterDeletingBlankLine.browserSelection.anchorNodeName),
        JSON.stringify(afterDeletingBlankLine, null, 2),
      ).toBe(true);
      expect(afterDeletingBlankLine.browserSelection.focusOffset, JSON.stringify(afterDeletingBlankLine, null, 2))
        .toBe(afterDeletingBlankLine.browserSelection.anchorOffset);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps the cursor at the heading end when Backspace removes the empty line created by Enter', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-heading-enter-backspace-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await openMarkdownFixture(page, {
        filename: 'heading-enter-backspace-caret.md',
        content: '# 1',
      });

      const headingRange = await setCursorAtTextEnd(page, '1');
      await page.keyboard.press('Enter');
      await waitForEditorAnimationFrame(page);
      const afterEnter = await collectSelectionDiagnostics(page);
      expect(afterEnter.selection, JSON.stringify(afterEnter, null, 2)).toMatchObject({
        empty: true,
      });

      await page.keyboard.press('Backspace');
      await waitForEditorAnimationFrame(page);
      const afterDeletingBlankLine = await collectSelectionDiagnostics(page);

      expect(afterDeletingBlankLine.html, JSON.stringify(afterDeletingBlankLine, null, 2)).not.toContain('<p');
      expect(afterDeletingBlankLine.selection, JSON.stringify(afterDeletingBlankLine, null, 2)).toMatchObject({
        empty: true,
        from: headingRange.to,
        to: headingRange.to,
      });
      expect(
        ['#text', 'H1'].includes(afterDeletingBlankLine.browserSelection.anchorNodeName),
        JSON.stringify(afterDeletingBlankLine, null, 2),
      ).toBe(true);
      expect(afterDeletingBlankLine.browserSelection.focusOffset, JSON.stringify(afterDeletingBlankLine, null, 2))
        .toBe(afterDeletingBlankLine.browserSelection.anchorOffset);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
