import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
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
  test('supports image library scrolling, sidebar wrapping, and reference-safe image rename', async () => {
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
          ...Array.from({ length: 30 }, (_value, index) => ({
            filename: `asset-${String(index).padStart(2, '0')}.svg`,
            content: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#4f8f76"/></svg>`,
          })),
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
      const scrollMetrics = await panel.locator('.slash-image-library-scroll').evaluate((element) => ({
        clientHeight: element.clientHeight,
        overflowY: window.getComputedStyle(element).overflowY,
        scrollHeight: element.scrollHeight,
      }));
      expect(scrollMetrics.overflowY).toBe('auto');
      expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

      const search = panel.locator('input[type="text"]').first();
      await search.fill('b6aaf');
      await expect(panel.locator(`[data-image-library-item="${LONG_IMAGE_NAME}"]`)).toBeVisible();
      await expect(panel.getByText(LONG_IMAGE_NAME, { exact: true })).toHaveCount(0);

      await page.keyboard.press('Escape');
      const coverImageRow = page.locator('[data-file-tree-kind="image"][data-file-tree-path="cover.svg"]');
      await coverImageRow.click({ button: 'right' });
      await page.locator('[data-sidebar-context-menu-item="rename"]').click();
      const renameInput = coverImageRow.getByRole('textbox');
      await renameInput.fill('renamed-cover.svg');
      await renameInput.press('Enter');

      const renamedImageRow = page.locator(
        '[data-file-tree-kind="image"][data-file-tree-path="renamed-cover.svg"]',
      );
      await expect(renamedImageRow).toBeVisible({ timeout: 10_000 });
      await expect.poll(async () => page.evaluate(() => (
        String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
      ))).toContain('vlaina_cover: "renamed-cover.svg"');
      await expect(
        noteRow.locator('[data-file-tree-image-background="renamed-cover.svg"]'),
      ).toBeVisible({ timeout: 10_000 });

      await expect(fs.stat(path.join(fixture.notesRootPath, 'renamed-cover.svg'))).resolves.toBeDefined();
      await expect(fs.stat(path.join(fixture.notesRootPath, 'cover.svg'))).rejects.toThrow();
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
