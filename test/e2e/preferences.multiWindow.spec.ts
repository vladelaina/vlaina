import { expect, test } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

test.describe('multi-window preference and cache sync', () => {
  test.setTimeout(90_000);

  test('syncs UI preferences, note preferences, and managed budget snapshots across windows', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('preferences-multi-window');

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
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
