import { expect, test, type Page } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  setAppViewMode,
} from './notesE2E';

const LIVE_API_BASE_URL = 'https://api.vlaina.com';
const runLiveApiE2E = process.env.VLAINA_E2E_LIVE_API === '1';

type ManagedModelSnapshot = {
  id: string;
  apiModelId: string;
  name: string;
  group?: string;
  selected?: boolean;
};

async function getManagedModels(page: Page): Promise<ManagedModelSnapshot[]> {
  return page.evaluate(() => {
    const data = (window as any).__vlainaE2E.getUnifiedData();
    return (data.ai.models as Array<ManagedModelSnapshot & { providerId: string; enabled?: boolean }>)
      .filter((model) => model.providerId === 'vlaina-managed' && model.enabled !== false)
      .map((model) => ({
        id: model.id,
        apiModelId: model.apiModelId,
        name: model.name,
        group: model.group,
        selected: model.id === data.ai.selectedModelId,
      }));
  });
}

test.describe('managed model catalog live API', () => {
  test.skip(!runLiveApiE2E, 'Set VLAINA_E2E_LIVE_API=1 to run against the live vlaina API.');
  test.setTimeout(90_000);

  test('loads managed models from the live API during notes startup prewarm and renders them in chat', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('chat-managed-models-live-api', {
      APP_API_BASE_URL: LIVE_API_BASE_URL,
    });

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await expect.poll(async () => (await getManagedModels(page)).length, { timeout: 30_000 }).toBeGreaterThan(0);
      const liveModels = await getManagedModels(page);
      const selectedModel = liveModels.find((model) => model.selected) ?? liveModels[0]!;
      expect(selectedModel.id).toContain('vlaina-managed::');
      expect(selectedModel.apiModelId).toBeTruthy();
      expect(selectedModel.name).toBeTruthy();

      await setAppViewMode(page, 'chat');
      await page.locator('.app-title-bar-center button').first().click();
      await expect(page.locator('[data-model-selector-dropdown="true"]')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(`[data-model-id="${selectedModel.id}"]`)).toBeVisible({ timeout: 10_000 });
      await expect.poll(
        () => page.locator(`[data-model-id="${selectedModel.id}"]`).innerText(),
        { timeout: 10_000 }
      ).not.toBe('');
      await expect.poll(
        () => page.locator('[data-model-selector-dropdown="true"] button[aria-label]').count(),
        { timeout: 10_000 }
      ).toBeGreaterThanOrEqual(2);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
