import { expect, test, type Page } from '@playwright/test';
import {
  BLOCK_CONTROLS_SELECTOR,
  EDITOR_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

async function openBlockSelectionFixture(page: Page): Promise<void> {
  const { notePath } = await page.evaluate(() =>
    (window as any).__vlainaE2E.createNotesFixture({
      filename: 'block-selection.md',
      content: [
        '# Block Selection',
        '',
        'First selectable paragraph',
        '',
        'Second selectable paragraph',
        '',
        '- Parent item',
        '  ```js',
        '  const value = 1',
        '  ```',
        '',
        'Final paragraph',
        '',
      ].join('\n'),
    })
  );

  await page.evaluate((pathToOpen) => (window as any).__vlainaE2E.openAbsoluteNote(pathToOpen), notePath);
  await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();
  await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'First selectable paragraph' })).toBeVisible();
  await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Second selectable paragraph' })).toBeVisible();
}

async function expectSelectedParagraphs(page: Page, texts: string[]): Promise<void> {
  await expect.poll(async () => page.evaluate((expectedTexts) => {
    const selected = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror .editor-block-selected'));
    return expectedTexts.map((text) => selected.some((element) => element.textContent?.includes(text)));
  }, texts)).toEqual(texts.map(() => true));
}

test.describe('notes block selection', () => {
  test.setTimeout(90_000);

  test('selects blocks from the text gutter and centers the drag handle on the selected block', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openBlockSelectionFixture(page);

      await expect.poll(async () => page.evaluate(() => (window as any).__vlainaE2E.getNoteSelectableBlocks()))
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ tagName: 'P', text: 'First selectable paragraph' }),
          expect.objectContaining({ tagName: 'P', text: 'Second selectable paragraph' }),
        ]));

      await expect(
        page.evaluate(() => (window as any).__vlainaE2E.selectNoteBlocksByText([
          'First selectable paragraph',
          'Second selectable paragraph',
        ]))
      ).resolves.toBe(2);
      await expectSelectedParagraphs(page, ['First selectable paragraph', 'Second selectable paragraph']);

      const firstSelected = page.locator(SELECTED_BLOCK_SELECTOR).first();
      const selectedRect = await firstSelected.boundingBox();
      if (!selectedRect) {
        throw new Error('Could not resolve selected block geometry');
      }

      await page.mouse.move(Math.max(8, selectedRect.x - 18), selectedRect.y + selectedRect.height / 2);
      await expect(page.locator(BLOCK_CONTROLS_SELECTOR)).toBeVisible();

      const geometry = await page.evaluate(() => {
        const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible');
        const selected = document.querySelector<HTMLElement>('.milkdown .ProseMirror .editor-block-selected');
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

      expect(geometry).not.toBeNull();
      expect(Math.abs(geometry!.controlsCenterY - geometry!.selectedCenterY)).toBeLessThanOrEqual(2);
      expect(geometry!.controlsLeft).toBeLessThan(geometry!.selectedLeft);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
