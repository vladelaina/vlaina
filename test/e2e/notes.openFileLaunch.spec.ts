import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

test.describe('notes desktop open-file launch', () => {
  test('opens a startup markdown file with its parent folder loaded in the sidebar', async () => {
    const externalRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vlaina-open-file-launch-'));
    const vaultPath = path.join(externalRoot, 'docs');
    const notePath = path.join(vaultPath, 'launch-note.md');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.writeFile(notePath, '# Launch Note\n\nStartup open-file sentinel.\n', 'utf8');

    const { app, userDataRoot } = await launchIsolatedElectron('notes-open-file-launch', {
      args: [notePath],
    });

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Startup open-file sentinel', {
        timeout: 30_000,
      });

      await expect.poll(async () => page.evaluate(() => {
        const vaultState = (window as any).__vlainaE2E.getVaultState();
        const notesState = (window as any).__vlainaE2E.getNotesState();
        return {
          currentVaultPath: vaultState.currentVault?.path ?? null,
          currentNotePath: notesState.currentNote?.path ?? null,
          fileRows: document.querySelectorAll('[data-file-tree-kind="file"]').length,
        };
      }), { timeout: 30_000 }).toMatchObject({
        currentVaultPath: vaultPath,
        currentNotePath: 'launch-note.md',
        fileRows: 1,
      });

      await expect(page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'launch-note' })).toBeVisible();
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
      await fs.rm(externalRoot, { recursive: true, force: true }).catch(() => {});
    }
  });
});
