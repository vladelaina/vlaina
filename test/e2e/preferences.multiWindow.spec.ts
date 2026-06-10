import { expect, test, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { E2E_DEV_SERVER_URL } from './notesE2E';

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
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vlaina-preferences-e2e-'));
  const userDataDir = path.join(root, 'user-data');

  const app = await electron.launch({
    args: ['.'],
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

test.describe('multi-window preference and cache sync', () => {
  test.setTimeout(90_000);

  test('syncs UI preferences, note preferences, and managed budget snapshots across windows', async () => {
    const { app, userDataDir } = await launchIsolatedElectron();

    try {
      await app.firstWindow();
      const [main] = await getOpenBridgePages(app, 1);
      await main.evaluate(() => (window as any).__vlainaE2E.createWindow({ viewMode: 'notes' }));
      const pages = await getOpenBridgePages(app, 2);
      const second = pages.find((page) => page !== main) ?? pages[1];

      await main.evaluate(() =>
        (window as any).__vlainaE2E.setUIPreferences({
          fontSize: 22,
          languagePreference: 'zh-CN',
          sidebarWidth: 384,
          imageStorageMode: 'vaultSubfolder',
          imageSubfolderName: 'synced-assets',
          notesChatPanelCollapsed: false,
        })
      );

      await expect.poll(async () => second.evaluate(() => (window as any).__vlainaE2E.getUIState())).toMatchObject({
        fontSize: 22,
        languagePreference: 'zh-CN',
        sidebarWidth: 384,
        imageStorageMode: 'vaultSubfolder',
        imageSubfolderName: 'synced-assets',
        notesChatPanelCollapsed: false,
      });

      await second.evaluate(() => (window as any).__vlainaE2E.setGlobalNoteIconSize(88));

      await expect.poll(async () =>
        main.evaluate(() => (window as any).__vlainaE2E.getNotesPreferences())
      ).toMatchObject({
        noteIconSize: 88,
      });

      await main.evaluate(() =>
        (window as any).__vlainaE2E.applyManagedBudgetSnapshot({
          active: true,
          usedPercent: 37,
          remainingPercent: 63,
          status: 'ok',
        })
      );

      await expect.poll(async () =>
        second.evaluate(() => (window as any).__vlainaE2E.getManagedBudgetState())
      ).toMatchObject({
        budget: {
          active: true,
          usedPercent: 37,
          remainingPercent: 63,
          status: 'ok',
        },
        budgetError: null,
        isRefreshingBudget: false,
      });

      await second.evaluate(() => (window as any).__vlainaE2E.clearManagedBudget());

      await expect.poll(async () =>
        main.evaluate(() => (window as any).__vlainaE2E.getManagedBudgetState())
      ).toMatchObject({
        budget: null,
        budgetError: null,
        isRefreshingBudget: false,
      });
    } finally {
      await closeElectron(app);
      await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
