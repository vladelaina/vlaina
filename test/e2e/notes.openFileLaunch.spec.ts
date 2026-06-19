import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {
  EDITOR_SELECTOR,
  E2E_DEV_SERVER_URL,
  FILE_TREE_FILE_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

const require = createRequire(import.meta.url);
const electronPath = String(require('electron'));

function waitForProcessExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(finish, timeoutMs);
    child.once('exit', finish);
    child.once('error', finish);
  });
}

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

  test('opens a second-instance markdown file with its parent folder loaded in the sidebar', async () => {
    const externalRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vlaina-open-file-second-'));
    const vaultPath = path.join(externalRoot, 'docs');
    const notePath = path.join(vaultPath, 'second-instance-note.md');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.writeFile(notePath, '# Second Instance Note\n\nForwarded open-file sentinel.\n', 'utf8');

    const { app, userDataRoot, userDataDir } = await launchIsolatedElectron('notes-open-file-second-instance');
    let secondInstance: ChildProcess | null = null;

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      secondInstance = spawn(electronPath, ['.', notePath], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          VITE_DEV_SERVER_URL: `${E2E_DEV_SERVER_URL}?e2e=1`,
          VLAINA_USER_DATA_DIR: userDataDir,
          APP_API_BASE_URL: 'http://127.0.0.1:9',
          APP_UPDATE_MANIFEST_URL: 'http://127.0.0.1:9/latest',
          NO_PROXY: '127.0.0.1,localhost',
          no_proxy: '127.0.0.1,localhost',
          HTTP_PROXY: '',
          HTTPS_PROXY: '',
          ALL_PROXY: '',
          http_proxy: '',
          https_proxy: '',
          all_proxy: '',
        },
        stdio: 'ignore',
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Forwarded open-file sentinel', {
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
        currentNotePath: 'second-instance-note.md',
        fileRows: 1,
      });

      await expect(page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'second-instance-note' })).toBeVisible();
      await waitForProcessExit(secondInstance, 10_000);
    } finally {
      if (secondInstance && !secondInstance.killed && secondInstance.exitCode === null) {
        secondInstance.kill('SIGKILL');
      }
      await cleanupIsolatedElectron(app, userDataRoot);
      await fs.rm(externalRoot, { recursive: true, force: true }).catch(() => {});
    }
  });
});
