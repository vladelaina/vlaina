import { expect, test, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { E2E_DEV_SERVER_URL } from './notesE2E';

async function waitForE2EBridge(page: Page) {
  await page.waitForFunction(() => Boolean((window as any).__vlainaE2E));
  await page.evaluate(() => (window as any).__vlainaE2E.waitForUnifiedLoaded());
}

async function getUnifiedData(page: Page) {
  return page.evaluate(() => (window as any).__vlainaE2E.getUnifiedData());
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
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vlaina-sync-e2e-'));
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

test.describe('multi-window storage sync', () => {
  test.setTimeout(90_000);

  test('syncs provider and settings changes across Electron windows', async () => {
    const { app, userDataDir } = await launchIsolatedElectron();

    try {
      await app.firstWindow();
      await getOpenBridgePages(app, 1);

      let [first] = await getOpenBridgePages(app, 1);
      await first.evaluate(() => (window as any).__vlainaE2E.createWindow({ viewMode: 'chat' }));
      let [main, second] = await getOpenBridgePages(app, 2);

      const providerId = await main.evaluate(() =>
        (window as any).__vlainaE2E.addProvider({
          name: 'E2E synced channel',
          apiHost: 'https://example.invalid/e2e',
          apiKey: 'sk-e2e',
        })
      );

      [main, second] = await getOpenBridgePages(app, 2);
      await expect.poll(async () => {
        const data = await getUnifiedData(second);
        return data.ai?.providers.some((provider: { id: string }) => provider.id === providerId);
      }).toBe(true);

      await second.evaluate(() => (window as any).__vlainaE2E.setTimezone(-5, 'New York'));
      await second.evaluate(() => (window as any).__vlainaE2E.setMarkdownLineNumbers(true));

      [main, second] = await getOpenBridgePages(app, 2);
      await expect.poll(async () => {
        const data = await getUnifiedData(main);
        return {
          city: data.settings.timezone.city,
          offset: data.settings.timezone.offset,
          showLineNumbers: data.settings.markdown.codeBlock.showLineNumbers,
        };
      }).toEqual({
        city: 'New York',
        offset: -5,
        showLineNumbers: true,
      });

      await second.evaluate((id) => (window as any).__vlainaE2E.deleteProvider(id), providerId);

      [main] = await getOpenBridgePages(app, 2);
      await expect.poll(async () => {
        const data = await getUnifiedData(main);
        return data.ai?.providers.some((provider: { id: string }) => provider.id === providerId);
      }).toBe(false);
    } finally {
      await closeElectron(app);
      await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
