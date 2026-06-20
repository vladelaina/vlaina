import { expect, test } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  createVaultFilesFixture,
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  getOpenBridgePages,
  launchIsolatedElectron,
  openVaultInNotes,
} from './notesE2E';

test.describe('notes open folder restore', () => {
  test('does not keep the startup blank draft when opening a populated vault without a saved workspace note', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-open-folder-populated-no-restore');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await expect.poll(async () => page.evaluate(() => {
        const state = (window as any).__vlainaE2E.getNotesState();
        return {
          currentNotePath: state.currentNote?.path ?? null,
          openTabPaths: state.openTabs.map((tab: { path: string }) => tab.path),
        };
      }), { timeout: 30_000 }).toMatchObject({
        currentNotePath: expect.stringMatching(/^draft:/),
        openTabPaths: [expect.stringMatching(/^draft:/)],
      });

      const fixture = await createVaultFilesFixture(page, {
        name: 'populated-no-restore',
        files: [
          {
            filename: 'alpha.md',
            content: '# Alpha\n\nExisting note sentinel.\n',
          },
        ],
      });

      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Populated No Restore',
        minFileCount: 1,
      });

      await expect.poll(async () => page.evaluate(() => {
        const notesState = (window as any).__vlainaE2E.getNotesState();
        const vaultState = (window as any).__vlainaE2E.getVaultState();
        return {
          currentVaultPath: vaultState.currentVault?.path ?? null,
          currentNotePath: notesState.currentNote?.path ?? null,
          openTabPaths: notesState.openTabs.map((tab: { path: string }) => tab.path),
          fileRows: document.querySelectorAll('[data-file-tree-kind="file"]').length,
        };
      }), { timeout: 30_000 }).toMatchObject({
        currentVaultPath: fixture.vaultPath,
        currentNotePath: null,
        openTabPaths: [],
        fileRows: 1,
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('restores the saved current note when reopening a populated vault', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-open-folder-restore-last-note');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const firstVault = await createVaultFilesFixture(page, {
        name: 'restore-last-note-a',
        files: [
          {
            filename: 'alpha.md',
            content: '# Alpha\n\nLast opened alpha sentinel.\n',
          },
        ],
      });
      const secondVault = await createVaultFilesFixture(page, {
        name: 'restore-last-note-b',
        files: [
          {
            filename: 'beta.md',
            content: '# Beta\n\nSecond vault sentinel.\n',
          },
        ],
      });

      await openVaultInNotes(page, {
        vaultPath: firstVault.vaultPath,
        name: 'Restore Last Note A',
        minFileCount: 1,
      });
      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'alpha' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Last opened alpha sentinel', {
        timeout: 30_000,
      });

      await openVaultInNotes(page, {
        vaultPath: secondVault.vaultPath,
        name: 'Restore Last Note B',
        minFileCount: 1,
      });
      await expect.poll(async () => page.evaluate(() => {
        const notesState = (window as any).__vlainaE2E.getNotesState();
        const vaultState = (window as any).__vlainaE2E.getVaultState();
        return {
          currentVaultPath: vaultState.currentVault?.path ?? null,
          currentNotePath: notesState.currentNote?.path ?? null,
          openTabPaths: notesState.openTabs.map((tab: { path: string }) => tab.path),
        };
      }), { timeout: 30_000 }).toMatchObject({
        currentVaultPath: secondVault.vaultPath,
        currentNotePath: null,
        openTabPaths: [],
      });

      await openVaultInNotes(page, {
        vaultPath: firstVault.vaultPath,
        name: 'Restore Last Note A',
        minFileCount: 1,
      });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Last opened alpha sentinel', {
        timeout: 30_000,
      });
      await expect.poll(async () => page.evaluate(() => {
        const notesState = (window as any).__vlainaE2E.getNotesState();
        const vaultState = (window as any).__vlainaE2E.getVaultState();
        return {
          currentVaultPath: vaultState.currentVault?.path ?? null,
          currentNotePath: notesState.currentNote?.path ?? null,
          openTabPaths: notesState.openTabs.map((tab: { path: string }) => tab.path),
        };
      }), { timeout: 30_000 }).toMatchObject({
        currentVaultPath: firstVault.vaultPath,
        currentNotePath: 'alpha.md',
        openTabPaths: ['alpha.md'],
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
