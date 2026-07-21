import { expect, test } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  createNotesRootFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openNotesRootInNotes,
} from './notesE2E';

const LONG_NOTE_NAME = 'a-markdown-file-name-that-must-not-control-sidebar-width';

test.describe('notes sidebar width', () => {
  test('keeps the chosen width for long names and resets to the viewport-based default', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-sidebar-width');

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
      await expect.poll(() => page.evaluate(() => (
        (window as any).__vlainaE2E.getUIState().sidebarWidth
      ))).toBe(270);

      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({ sidebarWidth: 700 }));
      await page.locator('[data-resize-handle="shell-sidebar"]').dblclick();
      await expect.poll(() => page.evaluate(() => (
        (window as any).__vlainaE2E.getUIState().sidebarWidth
      ))).toBe(358);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
