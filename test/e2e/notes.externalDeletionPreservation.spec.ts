import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

async function getNotesState(page: Page) {
  return page.evaluate(() => (window as any).__vlainaE2E.getNotesState());
}

test.describe('notes external deletion preservation', () => {
  test.setTimeout(90_000);

  test('preserves typed dirty content and reports an error when the backing file is deleted externally', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-external-deletion-preservation');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const opened = await openMarkdownFixture(page, {
        filename: 'external-delete-current.md',
        content: '# External delete\n\nBefore deletion',
      });
      const marker = ' typed before external deletion';

      await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
      await page.keyboard.type(marker);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText(marker.trim());
      await expect.poll(async () => {
        const state = await getNotesState(page);
        return {
          hasMarker: String(state.currentNote?.content ?? '').includes(marker.trim()),
          isDirty: state.isDirty,
        };
      }, { timeout: 10_000 }).toEqual({
        hasMarker: true,
        isDirty: true,
      });

      await fs.unlink(opened.notePath);
      await page.evaluate((pathToDelete) =>
        (window as any).__vlainaE2E.applyExternalPathDeletion(pathToDelete), opened.notePath);

      await expect.poll(async () => {
        const state = await getNotesState(page);
        return {
          path: state.currentNote?.path ?? null,
          hasMarker: String(state.currentNote?.content ?? '').includes(marker.trim()),
          isDirty: state.isDirty,
          tabDirty: state.openTabs.some((tab: { path: string; isDirty: boolean }) =>
            tab.path === opened.notePath && tab.isDirty
          ),
          error: state.error,
        };
      }, { timeout: 10_000 }).toEqual({
        path: opened.notePath,
        hasMarker: true,
        isDirty: true,
        tabDirty: true,
        error: 'Current note was deleted outside vlaina while you still have unsaved changes. Its content is preserved; save to restore it.',
      });

      await expect(fs.stat(opened.notePath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
