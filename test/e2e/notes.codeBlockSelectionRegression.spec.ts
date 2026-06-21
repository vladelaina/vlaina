import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

const CODE_BLOCK_SELECTOR = `${EDITOR_SELECTOR} .code-block-container`;

async function getCodeBlockDiagnostics(page: import('@playwright/test').Page, blockIndex = 0) {
  return page.evaluate((index) => {
    const codeBlock = Array.from(
      document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror .code-block-container')
    )[index] ?? null;
    const cm = codeBlock?.querySelector<HTMLElement>('.cm-editor') ?? null;
    const cursorLayer = codeBlock?.querySelector<HTMLElement>('.cm-cursorLayer') ?? null;
    const cursor = codeBlock?.querySelector<HTMLElement>('.cm-cursor') ?? null;
    const selectionBackgrounds = Array.from(
      codeBlock?.querySelectorAll<HTMLElement>('.cm-selectionBackground') ?? []
    ).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        height: rect.height,
        left: rect.left,
        top: rect.top,
        width: rect.width,
      };
    });

    return {
      activeElementClass: document.activeElement instanceof HTMLElement
        ? document.activeElement.className
        : '',
      codeBlockText: codeBlock?.textContent ?? '',
      codeSelectionActive: Boolean(cm?.classList.contains('editor-code-selection-active')),
      cursorLayerOpacity: cursorLayer ? getComputedStyle(cursorLayer).opacity : null,
      cursorOpacity: cursor ? getComputedStyle(cursor).opacity : null,
      lineTexts: Array.from(codeBlock?.querySelectorAll<HTMLElement>('.cm-line') ?? [])
        .map((line) => line.textContent ?? ''),
      selectedDocText: cm?.dataset.e2eSelectionText ?? null,
      selection: cm
        ? {
          anchor: Number(cm.dataset.e2eSelectionAnchor ?? 0),
          empty: cm.dataset.e2eSelectionFrom === cm.dataset.e2eSelectionTo,
          from: Number(cm.dataset.e2eSelectionFrom ?? 0),
          head: Number(cm.dataset.e2eSelectionHead ?? 0),
          to: Number(cm.dataset.e2eSelectionTo ?? 0),
        }
        : null,
      selectedTextMarks: Array.from(codeBlock?.querySelectorAll<HTMLElement>('.editor-code-selection-text') ?? [])
        .map((element) => element.textContent ?? ''),
      selectionBackgrounds,
      toolbar: (window as any).__vlainaE2E.getEditorToolbarDebugState(),
    };
  }, blockIndex);
}

test.describe('notes code block selection regressions', () => {
  test.setTimeout(120_000);

  test('keeps code block selection caret and blank-line behavior aligned with normal text', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-code-block-selection-regression');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'code-block-selection-regression-e2e.md',
        content: [
          'Before code selection regression sentinel',
          '',
          '```ts',
          '',
          'const codeSelectionSentinel = true;',
          '',
          '```',
          '',
          '```ts',
          'const previousLineOnly = true;',
          '',
          'const currentLineOnly = true;',
          '```',
          '',
          '```todo',
          '1hi',
          '',
          '2hi',
          '',
          '3hi',
          '```',
          '',
          'After code selection regression sentinel',
        ].join('\n'),
      });

      const codeBlock = page.locator(CODE_BLOCK_SELECTOR).first();
      await expect(codeBlock).toBeVisible({ timeout: 30_000 });
      await expect(codeBlock.locator('.cm-line').nth(1)).toContainText('codeSelectionSentinel');

      const codeLine = codeBlock.locator('.cm-line').nth(1);
      const codeLineBox = await codeLine.boundingBox();
      expect(codeLineBox).not.toBeNull();

      await page.mouse.click(codeLineBox!.x + 4, codeLineBox!.y + codeLineBox!.height / 2);
      await page.keyboard.down('Control');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.up('Control');
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page);
        return {
          codeSelectionActive: diagnostics.codeSelectionActive,
          selectedDocText: diagnostics.selectedDocText,
          selectedText: diagnostics.selectedTextMarks.join(''),
        };
      }, { timeout: 5_000 }).toMatchObject({
        codeSelectionActive: true,
        selectedDocText: 'const codeSelectionSentinel = true;',
        selectedText: 'const codeSelectionSentinel = true;',
      });

      const selected = await getCodeBlockDiagnostics(page);
      expect(selected.cursorLayerOpacity, selected).toBe('0');
      expect(selected.selectedDocText, selected).toBe('const codeSelectionSentinel = true;');
      expect(selected.selectedTextMarks.join(''), selected).toBe('const codeSelectionSentinel = true;');

      await page.keyboard.press('ArrowRight');
      await waitForEditorAnimationFrame(page);
      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page);
        return diagnostics.codeSelectionActive;
      }, { timeout: 5_000 }).toBe(false);

      const leadingBlankLine = codeBlock.locator('.cm-line').first();
      const leadingBlankLineBox = await leadingBlankLine.boundingBox();
      expect(leadingBlankLineBox).not.toBeNull();

      await page.mouse.click(
        leadingBlankLineBox!.x + 4,
        leadingBlankLineBox!.y + leadingBlankLineBox!.height / 2,
      );
      await page.keyboard.down('Control');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.up('Control');
      await waitForEditorAnimationFrame(page);
      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page);
        return diagnostics.selectedDocText;
      }, { timeout: 5_000 }).toBe('const codeSelectionSentinel = true;');

      await page.keyboard.press('ArrowRight');
      await waitForEditorAnimationFrame(page);
      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page);
        return diagnostics.codeSelectionActive;
      }, { timeout: 5_000 }).toBe(false);

      const trailingBlankLine = codeBlock.locator('.cm-line').nth(2);
      const trailingBlankLineBox = await trailingBlankLine.boundingBox();
      expect(trailingBlankLineBox).not.toBeNull();

      await page.mouse.click(
        trailingBlankLineBox!.x + 4,
        trailingBlankLineBox!.y + trailingBlankLineBox!.height / 2,
      );
      await page.keyboard.down('Control');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.up('Control');
      await waitForEditorAnimationFrame(page);
      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page);
        return diagnostics.selectedDocText;
      }, { timeout: 5_000 }).toBe('const codeSelectionSentinel = true;');

      await page.keyboard.press('ArrowRight');
      await waitForEditorAnimationFrame(page);
      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page);
        return diagnostics.codeSelectionActive;
      }, { timeout: 5_000 }).toBe(false);

      await page.mouse.click(
        leadingBlankLineBox!.x + 4,
        leadingBlankLineBox!.y + leadingBlankLineBox!.height / 2,
      );
      await page.keyboard.press('Backspace');
      await waitForEditorAnimationFrame(page);

      const afterBackspace = await getCodeBlockDiagnostics(page);
      expect(afterBackspace.lineTexts[0], afterBackspace).toContain('codeSelectionSentinel');

      const secondCodeBlock = page.locator(CODE_BLOCK_SELECTOR).nth(1);
      await expect(secondCodeBlock.locator('.cm-line').nth(2)).toContainText('currentLineOnly');
      const currentLine = secondCodeBlock.locator('.cm-line').nth(2);
      await currentLine.scrollIntoViewIfNeeded();
      const currentLineBox = await currentLine.boundingBox();
      expect(currentLineBox).not.toBeNull();

      const previousLine = secondCodeBlock.locator('.cm-line').first();
      const previousLineBox = await previousLine.boundingBox();
      expect(previousLineBox).not.toBeNull();

      await page.mouse.click(previousLineBox!.x + 8, previousLineBox!.y + previousLineBox!.height / 2);
      await page.keyboard.press('End');
      await page.keyboard.down('Shift');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.up('Shift');
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page, 1);
        return diagnostics.selectedDocText;
      }, { timeout: 10_000 }).toBe('const currentLineOnly = true;');

      const shiftDownSelection = await getCodeBlockDiagnostics(page, 1);
      expect(shiftDownSelection.selectedDocText, shiftDownSelection).not.toContain('\n');

      await page.keyboard.press('ArrowRight');
      await waitForEditorAnimationFrame(page);

      await page.mouse.click(currentLineBox!.x + 8, currentLineBox!.y + currentLineBox!.height / 2);
      await page.keyboard.press('Home');
      await page.keyboard.down('Shift');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.up('Shift');
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page, 1);
        return diagnostics.selectedDocText;
      }, { timeout: 10_000 }).toBe('const previousLineOnly = true;');

      const shiftUpSelection = await getCodeBlockDiagnostics(page, 1);
      expect(shiftUpSelection.selectedDocText, shiftUpSelection).not.toContain('\n');

      await page.keyboard.press('ArrowRight');
      await waitForEditorAnimationFrame(page);

      await page.mouse.click(previousLineBox!.x + 8, previousLineBox!.y + previousLineBox!.height / 2);
      await page.keyboard.press('End');
      await page.keyboard.down('Shift');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.up('Shift');
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page, 1);
        return diagnostics.selectedDocText;
      }, { timeout: 10_000 }).toBe('\n');

      await page.keyboard.press('ArrowRight');
      await waitForEditorAnimationFrame(page);

      await page.mouse.click(currentLineBox!.x + 8, currentLineBox!.y + currentLineBox!.height / 2);
      await page.keyboard.press('Home');
      await page.keyboard.down('Shift');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.up('Shift');
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page, 1);
        return diagnostics.selectedDocText;
      }, { timeout: 10_000 }).toBe('\n');

      await page.keyboard.press('ArrowRight');
      await waitForEditorAnimationFrame(page);

      await page.mouse.click(currentLineBox!.x + 8, currentLineBox!.y + currentLineBox!.height / 2);
      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page, 1);
        return diagnostics.activeElementClass;
      }, { timeout: 5_000 }).toContain('cm-content');

      await page.keyboard.down('Control');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.up('Control');
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page, 1);
        return {
          empty: diagnostics.selection?.empty,
          selectedDocText: diagnostics.selectedDocText,
        };
      }, { timeout: 10_000 }).toMatchObject({
        empty: false,
        selectedDocText: 'const currentLineOnly = true;',
      });

      const currentOnlySelection = await getCodeBlockDiagnostics(page, 1);
      expect(currentOnlySelection.selectedDocText, currentOnlySelection).not.toContain('\n');
      expect(currentOnlySelection.selectedTextMarks.join(''), currentOnlySelection)
        .toBe('const currentLineOnly = true;');

      const spacedCodeBlock = page.locator(CODE_BLOCK_SELECTOR).nth(2);
      await expect(spacedCodeBlock.locator('.cm-line').nth(4)).toContainText('3hi');
      const thirdLine = spacedCodeBlock.locator('.cm-line').nth(4);
      await thirdLine.scrollIntoViewIfNeeded();
      const thirdLineBox = await thirdLine.boundingBox();
      expect(thirdLineBox).not.toBeNull();

      await page.mouse.click(thirdLineBox!.x + 8, thirdLineBox!.y + thirdLineBox!.height / 2);
      await page.keyboard.press('End');
      await page.keyboard.down('Control');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.up('Control');
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page, 2);
        return diagnostics.selectedDocText;
      }, { timeout: 10_000 }).toBe('3hi');

      await page.keyboard.down('Control');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.up('Control');
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page, 2);
        return diagnostics.selectedDocText;
      }, { timeout: 10_000 }).toBe('2hi\n\n3hi');

      await page.keyboard.press('ArrowRight');
      await waitForEditorAnimationFrame(page);

      await page.mouse.click(thirdLineBox!.x + 8, thirdLineBox!.y + thirdLineBox!.height / 2);
      await page.keyboard.press('End');
      await page.keyboard.down('Shift');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.up('Shift');
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page, 2);
        return diagnostics.selectedDocText;
      }, { timeout: 10_000 }).toBe('3hi');

      await page.keyboard.down('Shift');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.up('Shift');
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => {
        const diagnostics = await getCodeBlockDiagnostics(page, 2);
        return diagnostics.selectedDocText;
      }, { timeout: 10_000 }).toBe('2hi\n\n3hi');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
