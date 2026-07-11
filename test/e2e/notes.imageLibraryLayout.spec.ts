import { expect, test } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  createNotesRootFilesFixture,
  FILE_TREE_FILE_SELECTOR,
  getOpenBridgePages,
  launchIsolatedElectron,
  openNotesRootInNotes,
} from './notesE2E';

const LONG_IMAGE_NAME = 'b6aaf51dac026c53249b1b5cf4f77ca68c29b060.gif';

test.describe('notes image library layout', () => {
  test('wraps long image names and shows note covers behind sidebar names', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-image-library-layout');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'image-library-layout',
        files: [
          {
            filename: 'covered-note.md',
            content: [
              '---',
              'vlaina_cover: "cover.svg"',
              '---',
              '',
              '# Covered note',
              '',
            ].join('\n'),
          },
          {
            filename: 'cover.svg',
            content: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#4f8f76"/></svg>',
          },
          { filename: LONG_IMAGE_NAME, content: 'GIF89a' },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Image Library Layout NotesRoot',
      });

      const sidebarImageName = page.locator(
        `[data-file-tree-image-name="${LONG_IMAGE_NAME}"]`,
      );
      await expect(sidebarImageName).toBeVisible();

      const sidebarLayout = await sidebarImageName.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          clientWidth: element.clientWidth,
          height: rect.height,
          lineHeight: Number.parseFloat(style.lineHeight),
          scrollWidth: element.scrollWidth,
          whiteSpace: style.whiteSpace,
          wordBreak: style.wordBreak,
          overflowWrap: style.overflowWrap,
        };
      });

      expect(sidebarLayout.whiteSpace).toBe('normal');
      expect(sidebarLayout.wordBreak).toBe('break-all');
      expect(sidebarLayout.overflowWrap).toBe('anywhere');
      expect(sidebarLayout.scrollWidth).toBeLessThanOrEqual(sidebarLayout.clientWidth + 1);
      expect(sidebarLayout.height).toBeGreaterThan(sidebarLayout.lineHeight * 1.5);

      const noteRow = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'covered-note' }).first();
      await expect(noteRow).toBeVisible();
      await noteRow.click();
      await expect(
        noteRow.locator('[data-file-tree-image-background="cover.svg"]'),
      ).toBeVisible({ timeout: 10_000 });

      const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
      expect(focused).toBe(true);
      await page.keyboard.type('/ima');
      await expect(page.locator('.slash-menu-item.selected')).toContainText(/Image|图片/);
      await page.keyboard.press('Enter');

      const panel = page.locator('.slash-menu.slash-image-library');
      await expect(panel).toBeVisible({ timeout: 10_000 });
      const fileName = panel.getByText(LONG_IMAGE_NAME, { exact: true });
      await expect(fileName).toBeVisible();

      const layout = await fileName.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          clientWidth: element.clientWidth,
          height: rect.height,
          lineHeight: Number.parseFloat(style.lineHeight),
          scrollWidth: element.scrollWidth,
          whiteSpace: style.whiteSpace,
          wordBreak: style.wordBreak,
          overflowWrap: style.overflowWrap,
        };
      });

      expect(layout.whiteSpace).toBe('normal');
      expect(layout.wordBreak).toBe('break-all');
      expect(layout.overflowWrap).toBe('anywhere');
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
      expect(layout.height).toBeGreaterThan(layout.lineHeight * 1.5);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
