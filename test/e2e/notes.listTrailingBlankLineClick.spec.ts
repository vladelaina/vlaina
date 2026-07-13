import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openAbsoluteNote,
  openMarkdownFixture,
} from './notesE2E';

const MARKDOWN_BLANK_LINE_SELECTOR =
  '[data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"]';
const TEXTBLOCK_CARET_OVERLAY_SELECTOR = '.editor-textblock-caret-overlay';

test.describe('notes list trailing blank line click', () => {
  test('edits the authored blank line between an ordered list and the next paragraph', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-list-trailing-blank-line-click');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 945, height: 1036 });

      for (const blankLineIndex of [0, 1]) {
        const opened = await openMarkdownFixture(page, {
          filename: `list-trailing-blank-line-click-${blankLineIndex}.md`,
          content: [
            '---',
            'vlaina_icon: "🔄"',
            '---',
            '6. Control the computer like another coding assistant',
            '6. Add an introductory walkthrough on first launch',
            '8. Add browser-style tabs',
            '',
            '',
            'v1',
          ].join('\n'),
        });

        const blankLines = page.locator(`${EDITOR_SELECTOR} ${MARKDOWN_BLANK_LINE_SELECTOR}`);
        await expect(blankLines).toHaveCount(2, { timeout: 30_000 });
        const blankLine = blankLines.nth(blankLineIndex);
        const box = await blankLine.boundingBox();
        expect(box).not.toBeNull();

        if (blankLineIndex === 0) {
          const listBox = await page.locator(`${EDITOR_SELECTOR} > ol`).boundingBox();
          expect(listBox).not.toBeNull();
          expect(box!.y).toBeGreaterThan(listBox!.y + listBox!.height);
          await page.mouse.click(box!.x + 16, listBox!.y + listBox!.height + 1);
        } else {
          await page.mouse.click(box!.x + 16, box!.y + box!.height / 2);
        }
        await expect(page.locator(TEXTBLOCK_CARET_OVERLAY_SELECTOR)).toBeVisible({ timeout: 10_000 });
        const marker = `inserted blank ${blankLineIndex + 1}`;
        await page.keyboard.type(marker);

        await expect(page.locator(EDITOR_SELECTOR)).toContainText(marker);
        await expect.poll(async () => page.evaluate(() =>
          String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
        )).toContain(marker);

        await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
        await openAbsoluteNote(page, opened.notePath);
        await expect(page.locator(`${EDITOR_SELECTOR} > p`)).toContainText([marker, 'v1']);
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
