import { expect, test, type Page } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

async function getUnifiedData(page: Page) {
  return page.evaluate(() => (window as any).__vlainaE2E.getUnifiedData());
}

test.describe('multi-window storage sync', () => {
  test.setTimeout(90_000);

  test('syncs provider and settings changes across Electron windows', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('sync-multi-window');

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
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
