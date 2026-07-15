import { expect, test } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  createNotesRootFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openNotesRootInNotes,
} from './notesE2E';

const LONG_NOTE_NAME = 'a-markdown-file-name-that-must-stay-on-one-line';

test.describe('notes sidebar automatic width', () => {
  test('does not resize when a folder with long file names is expanded later', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-sidebar-collapsed-width');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({
        languagePreference: 'en',
        sidebarWidth: 270,
      }));
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'Collapsed Sidebar Width Notes Root',
        files: [
          {
            filename: `collapsed/${LONG_NOTE_NAME}.md`,
            content: '# Collapsed sidebar width sentinel',
          },
          { filename: 'short.md', content: '# Short note' },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        minFileCount: 1,
      });
      await expect.poll(() => page.evaluate(() => (
        (window as any).__vlainaE2E.getUIState().sidebarWidth
      ))).toBe(270);

      await page.locator('[data-file-tree-kind="folder"][data-file-tree-path="collapsed"]').click();
      await expect(page.locator(
        `[data-file-tree-kind="file"][data-file-tree-path="collapsed/${LONG_NOTE_NAME}.md"]`,
      )).toBeVisible();
      await expect.poll(() => page.evaluate(() => (
        (window as any).__vlainaE2E.getUIState().sidebarWidth
      ))).toBe(270);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('widens enough to keep the file name clear of the more-actions button', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-sidebar-automatic-width');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({
        languagePreference: 'en',
        sidebarWidth: 270,
      }));
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'Sidebar Width Notes Root',
        files: [
          { filename: `${LONG_NOTE_NAME}.md`, content: '# Sidebar width sentinel' },
          { filename: 'short.md', content: '# Short note' },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        minFileCount: 2,
      });

      const readMetrics = () => page.evaluate((noteName) => {
        const row = document.querySelector<HTMLElement>(
          `[data-file-tree-kind="file"][data-file-tree-path="${noteName}.md"]`,
        );
        const sidebar = document.querySelector<HTMLElement>('[data-shell-sidebar-width-scope="true"] aside');
        const button = row?.querySelector<HTMLElement>('button');
        const title = Array.from(row?.querySelectorAll<HTMLElement>('span') ?? [])
          .find((element) => element.textContent === noteName && element.children.length === 0);
        if (!row || !sidebar || !button || !title) return null;

        const titleRects = Array.from(title.getClientRects());
        const titleRect = title.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        const titleStyle = getComputedStyle(title);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          context.font = titleStyle.font;
        }
        return {
          storedWidth: (window as any).__vlainaE2E.getUIState().sidebarWidth,
          renderedWidth: sidebar.getBoundingClientRect().width,
          titleLineCount: new Set(titleRects.map((rect) => Math.round(rect.top * 100) / 100)).size,
          titleLeft: titleRect.left,
          titleRight: titleRect.right,
          buttonLeft: buttonRect.left,
          measuredTextWidth: context?.measureText(noteName).width ?? 0,
          font: titleStyle.font,
        };
      }, LONG_NOTE_NAME);

      await expect.poll(readMetrics, { timeout: 30_000 }).not.toBeNull();
      const metrics = await readMetrics();
      expect(metrics).not.toBeNull();
      expect(metrics!.storedWidth).toBeGreaterThan(270);
      expect(metrics!.renderedWidth).toBeCloseTo(metrics!.storedWidth, 0);
      expect(metrics!.titleLineCount).toBe(1);
      expect(metrics!.titleRight).toBeLessThanOrEqual(metrics!.buttonLeft);

      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({ sidebarWidth: 560 }));
      await expect.poll(() => page.evaluate(() => (
        (window as any).__vlainaE2E.getUIState().sidebarWidth
      ))).toBe(560);
      await page.locator('[data-resize-handle="shell-sidebar"]').dblclick();
      await expect.poll(() => page.evaluate(() => (
        (window as any).__vlainaE2E.getUIState().sidebarWidth
      ))).toBe(metrics!.storedWidth);

    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
