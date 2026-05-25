import { expect, test, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function waitForE2EBridge(page: Page) {
  await page.waitForFunction(() => Boolean((window as any).__vlainaE2E));
  await page.evaluate(() => (window as any).__vlainaE2E.waitForUnifiedLoaded());
}

async function getOpenBridgePages(app: ElectronApplication, count: number): Promise<Page[]> {
  await expect.poll(() => app.windows().filter((page) => !page.isClosed()).length).toBeGreaterThanOrEqual(count);
  const pages = app.windows().filter((page) => !page.isClosed()).slice(0, count);
  await Promise.all(pages.map(waitForE2EBridge));
  return pages;
}

async function launchIsolatedElectron(): Promise<{
  app: ElectronApplication;
  userDataDir: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vlaina-notes-e2e-'));
  const userDataDir = path.join(root, 'user-data');

  const app = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: 'http://127.0.0.1:3100?e2e=1',
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
  });

  return { app, userDataDir: root };
}

async function closeElectron(app: ElectronApplication): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  await Promise.race([
    app.close().finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }),
    new Promise<void>((resolve) => {
      timeoutId = setTimeout(() => {
        app.process()?.kill('SIGKILL');
        resolve();
      }, 5000);
    }),
  ]).catch(() => {
    app.process()?.kill('SIGKILL');
  });
}

async function getNotesState(page: Page) {
  return page.evaluate(() => (window as any).__vlainaE2E.getNotesState());
}

test.describe('multi-window note document sync', () => {
  test.setTimeout(90_000);

  test('reloads clean notes and merges non-conflicting stale edits without blocking save', async () => {
    const { app, userDataDir } = await launchIsolatedElectron();

    try {
      await app.firstWindow();
      let [main] = await getOpenBridgePages(app, 1);
      const { notePath } = await main.evaluate(() =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'shared.md',
          content: '# Shared\n\nA: initial\n\nB: initial\n',
        })
      );

      await main.evaluate((path) => (window as any).__vlainaE2E.openAbsoluteNote(path), notePath);
      await main.evaluate(() => (window as any).__vlainaE2E.createWindow({ viewMode: 'notes' }));
      const pages = await getOpenBridgePages(app, 2);
      const second = pages.find((page) => page !== main) ?? pages[1];
      await second.evaluate((path) => (window as any).__vlainaE2E.openAbsoluteNote(path), notePath);

      await main.evaluate(() =>
        (window as any).__vlainaE2E.updateCurrentNoteContent('# Shared\n\nA: changed in main\n\nB: initial\n')
      );
      await main.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());

      await expect.poll(async () => {
        const result = await second.evaluate(() => (window as any).__vlainaE2E.syncCurrentNoteFromDisk({ force: true }));
        const state = await getNotesState(second);
        return { result, content: state.currentNote?.content, dirty: state.isDirty, error: state.error };
      }).toEqual({
        result: 'reloaded',
        content: expect.stringContaining('A: changed in main'),
        dirty: false,
        error: null,
      });

      await second.evaluate(() => {
        const state = (window as any).__vlainaE2E.getNotesState();
        const content = String(state.currentNote?.content ?? '');
        (window as any).__vlainaE2E.updateCurrentNoteContent(
          content.replace('B: initial', 'B: changed in second')
        );
      });
      await second.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());

      const diskContent = await second.evaluate((path) => (window as any).__vlainaE2E.readTextFile(path), notePath);
      expect(diskContent).toContain('A: changed in main');
      expect(diskContent).toContain('B: changed in second');

      await main.evaluate(() => (window as any).__vlainaE2E.syncCurrentNoteFromDisk({ force: true }));
      const mainState = await getNotesState(main);
      expect(mainState.currentNote?.content).toContain('A: changed in main');
      expect(mainState.currentNote?.content).toContain('B: changed in second');
      expect(mainState.isDirty).toBe(false);
      expect(mainState.error).toBeNull();
    } finally {
      await closeElectron(app);
      await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('preserves dirty content and reports a conflict for overlapping stale edits', async () => {
    const { app, userDataDir } = await launchIsolatedElectron();

    try {
      await app.firstWindow();
      const [main] = await getOpenBridgePages(app, 1);
      const { notePath } = await main.evaluate(() =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'conflict.md',
          content: '# Conflict\n\nLine: initial\n',
        })
      );
      await main.evaluate((path) => (window as any).__vlainaE2E.openAbsoluteNote(path), notePath);
      await main.evaluate(() => (window as any).__vlainaE2E.createWindow({ viewMode: 'notes' }));
      const [, second] = await getOpenBridgePages(app, 2);
      await second.evaluate((path) => (window as any).__vlainaE2E.openAbsoluteNote(path), notePath);

      await main.evaluate(() =>
        (window as any).__vlainaE2E.updateCurrentNoteContent('# Conflict\n\nLine: changed in main\n')
      );
      await main.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());

      await second.evaluate(() =>
        (window as any).__vlainaE2E.updateCurrentNoteContent('# Conflict\n\nLine: changed in second\n')
      );
      await second.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());

      const secondState = await getNotesState(second);
      const diskContent = await second.evaluate((path) => (window as any).__vlainaE2E.readTextFile(path), notePath);
      expect(secondState.isDirty).toBe(true);
      expect(secondState.currentNote?.content).toContain('Line: changed in second');
      expect(secondState.error).toContain('Current note changed on disk');
      expect(diskContent).toContain('Line: changed in main');
      expect(diskContent).not.toContain('Line: changed in second');
    } finally {
      await closeElectron(app);
      await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
