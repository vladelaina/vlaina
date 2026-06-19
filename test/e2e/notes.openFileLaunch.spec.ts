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
  async function expectOpenedMarkdownFile(
    page: Awaited<ReturnType<typeof getOpenBridgePages>>[number],
    input: {
      vaultPath: string;
      notePath: string;
      noteName: string;
      sentinel: string;
    },
  ) {
    await page.setViewportSize({ width: 1280, height: 860 });

    await expect(page.locator(EDITOR_SELECTOR)).toContainText(input.sentinel, {
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
      currentVaultPath: input.vaultPath,
      currentNotePath: input.noteName,
      fileRows: 1,
    });

    await expect(page.locator(FILE_TREE_FILE_SELECTOR, { hasText: input.notePath })).toBeVisible();
  }

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
      await expectOpenedMarkdownFile(page, {
        vaultPath,
        notePath: 'launch-note',
        noteName: 'launch-note.md',
        sentinel: 'Startup open-file sentinel',
      });
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

      await expectOpenedMarkdownFile(page, {
        vaultPath,
        notePath: 'second-instance-note',
        noteName: 'second-instance-note.md',
        sentinel: 'Forwarded open-file sentinel',
      });
      await waitForProcessExit(secondInstance, 10_000);
    } finally {
      if (secondInstance && !secondInstance.killed && secondInstance.exitCode === null) {
        secondInstance.kill('SIGKILL');
      }
      await cleanupIsolatedElectron(app, userDataRoot);
      await fs.rm(externalRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('opens an authorized renderer markdown target with its parent folder loaded in the sidebar', async () => {
    const externalRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vlaina-open-file-renderer-'));
    const vaultPath = path.join(externalRoot, 'docs');
    const notePath = path.join(vaultPath, 'renderer-target-note.md');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.writeFile(notePath, '# Renderer Target Note\n\nRenderer target sentinel.\n', 'utf8');

    const { app, userDataRoot } = await launchIsolatedElectron('notes-open-file-renderer-target');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await page.evaluate(async (pathToOpen) => {
        await window.vlainaDesktop?.dragDrop.authorizePath(pathToOpen);
        window.dispatchEvent(new CustomEvent('app-open-markdown-target', {
          detail: pathToOpen,
        }));
      }, notePath);

      await expectOpenedMarkdownFile(page, {
        vaultPath,
        notePath: 'renderer-target-note',
        noteName: 'renderer-target-note.md',
        sentinel: 'Renderer target sentinel',
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
      await fs.rm(externalRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('opens the same markdown file consistently across isolated dev profiles', async () => {
    const externalRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vlaina-open-file-consistent-'));
    const vaultPath = path.join(externalRoot, 'docs');
    const notePath = path.join(vaultPath, 'consistent-note.md');
    await fs.mkdir(vaultPath, { recursive: true });
    await fs.writeFile(notePath, '# Consistent Note\n\nConsistent isolated profile sentinel.\n', 'utf8');

    const first = await launchIsolatedElectron('notes-open-file-consistent-a', {
      args: [notePath],
    });
    const second = await launchIsolatedElectron('notes-open-file-consistent-b', {
      args: [notePath],
    });

    try {
      await Promise.all([first.app.firstWindow(), second.app.firstWindow()]);
      const [[firstPage], [secondPage]] = await Promise.all([
        getOpenBridgePages(first.app, 1),
        getOpenBridgePages(second.app, 1),
      ]);

      await Promise.all([
        expectOpenedMarkdownFile(firstPage, {
          vaultPath,
          notePath: 'consistent-note',
          noteName: 'consistent-note.md',
          sentinel: 'Consistent isolated profile sentinel',
        }),
        expectOpenedMarkdownFile(secondPage, {
          vaultPath,
          notePath: 'consistent-note',
          noteName: 'consistent-note.md',
          sentinel: 'Consistent isolated profile sentinel',
        }),
      ]);
    } finally {
      await cleanupIsolatedElectron(first.app, first.userDataRoot);
      await cleanupIsolatedElectron(second.app, second.userDataRoot);
      await fs.rm(externalRoot, { recursive: true, force: true }).catch(() => {});
    }
  });
});
