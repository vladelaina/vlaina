import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  cleanupIsolatedElectron,
  createVaultFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openVaultInNotes,
  waitForEditorAnimationFrame,
} from './notesE2E';

async function setContentCommitThrottleMs(page: Page, throttleMs: number): Promise<void> {
  await page.evaluate((ms) => {
    (globalThis as { __VL_TEST_CONTENT_COMMIT_THROTTLE_MS__?: number })
      .__VL_TEST_CONTENT_COMMIT_THROTTLE_MS__ = ms;
  }, throttleMs);
}

test.describe('notes autosave switch audit', () => {
  test.setTimeout(120_000);

  test('saves pending editor markdown before opening another sidebar file', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-autosave-switch-audit');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await setContentCommitThrottleMs(page, 5_000);

      const marker = `autosave switch marker ${Date.now()}`;
      const fixture = await createVaultFilesFixture(page, {
        name: 'autosave-switch-audit',
        files: [
          {
            filename: 'alpha-autosave-switch.md',
            content: ['# Alpha Autosave Switch', '', 'Alpha body before pending edit.'].join('\n'),
          },
          {
            filename: 'beta-autosave-switch.md',
            content: ['# Beta Autosave Switch', '', 'Beta body must stay isolated.'].join('\n'),
          },
        ],
      });

      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Autosave Switch Audit',
        minFileCount: 2,
      });

      const alphaRow = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'alpha-autosave-switch' }).first();
      const betaRow = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'beta-autosave-switch' }).first();

      await alphaRow.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Alpha body before pending edit.', {
        timeout: 30_000,
      });

      const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
      expect(focused).toBe(true);
      await page.keyboard.type(`\n\n${marker}`, { delay: 0 });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText(marker, { timeout: 10_000 });
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () =>
        page.evaluate((pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead), fixture.notePaths[0]!)
      , { timeout: 1_000 }).not.toContain(marker);

      await betaRow.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Beta body must stay isolated.', {
        timeout: 30_000,
      });

      await expect.poll(async () =>
        page.evaluate((pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead), fixture.notePaths[0]!)
      , { timeout: 10_000 }).toContain(marker);

      const stateAfterSwitch = await page.evaluate(() => (window as any).__vlainaE2E.getNotesState());
      expect(stateAfterSwitch.currentNote?.path).toContain('beta-autosave-switch.md');
      expect(stateAfterSwitch.currentNote?.content).toContain('Beta body must stay isolated.');
      expect(stateAfterSwitch.currentNote?.content).not.toContain(marker);
      expect(stateAfterSwitch.openTabs.some((tab: { isDirty?: boolean }) => tab.isDirty)).toBe(false);
      expect(stateAfterSwitch.error).toBeNull();

      await alphaRow.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText(marker, { timeout: 30_000 });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
