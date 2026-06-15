import { expect, test, type Page } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  setAppViewMode,
} from './notesE2E';

const SETTINGS_MODAL_SELECTOR = '[data-settings-modal="true"]';

async function openSettings(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('open-settings'));
  });
  await expect(page.locator(SETTINGS_MODAL_SELECTOR)).toBeVisible({ timeout: 30_000 });
}

async function openAITab(page: Page) {
  await page.locator('[data-settings-tab="ai"]').click();
  await expect(page.locator(SETTINGS_MODAL_SELECTOR)).toHaveAttribute('data-settings-active-tab', 'ai', {
    timeout: 10_000,
  });
  await expect(page.locator('[data-settings-tab-panel="ai"]')).toBeVisible({ timeout: 10_000 });
}

async function getCustomProviderNames(page: Page): Promise<string[]> {
  const data = await page.evaluate(() => (window as any).__vlainaE2E.getUnifiedData());
  return data.ai.providers
    .filter((provider: { id: string }) => provider.id !== 'vlaina-managed')
    .map((provider: { name: string }) => provider.name);
}

async function getRenderedChannelNames(page: Page): Promise<string[]> {
  return page.locator('[data-settings-ai-channel-card]').evaluateAll((cards) =>
    cards.map((card) => card.textContent ?? '')
  );
}

async function getModelSelectorProviderNames(page: Page): Promise<string[]> {
  return page.locator('[data-model-selector-provider-label]').evaluateAll((labels) =>
    labels.map((label) => label.textContent?.trim() ?? '')
  );
}

async function dragChannelToChannel(page: Page, sourceName: string, targetName: string) {
  const source = page.locator('[data-settings-ai-channel-card]').filter({ hasText: sourceName });
  const target = page.locator('[data-settings-ai-channel-card]').filter({ hasText: targetName });
  await expect(source).toBeVisible({ timeout: 10_000 });
  await expect(target).toBeVisible({ timeout: 10_000 });

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error('Channel card bounds were not available');
  }

  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;
  const targetX = targetBox.x + targetBox.width / 2;
  const targetY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(sourceX, sourceY + 12, { steps: 4 });
  await page.mouse.move(targetX, targetY, { steps: 18 });
  await page.mouse.up();
}

test.describe('AI channel reorder', () => {
  test.setTimeout(90_000);

  test('persists channel order after dragging a channel card', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('settings-ai-channel-reorder');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const providerAId = await page.evaluate(() => (window as any).__vlainaE2E.addProvider({
        name: 'E2E Channel A',
        apiHost: 'https://a.example.invalid/v1',
        apiKey: 'sk-a',
      }));
      const providerBId = await page.evaluate(() => (window as any).__vlainaE2E.addProvider({
        name: 'E2E Channel B',
        apiHost: 'https://b.example.invalid/v1',
        apiKey: 'sk-b',
      }));
      const providerCId = await page.evaluate(() => (window as any).__vlainaE2E.addProvider({
        name: 'E2E Channel C',
        apiHost: 'https://c.example.invalid/v1',
        apiKey: 'sk-c',
      }));
      await page.evaluate((providerId) => (window as any).__vlainaE2E.addModel({
        providerId,
        apiModelId: 'e2e-channel-a-model',
        name: 'E2E Channel A Model',
        selected: false,
      }), providerAId);
      await page.evaluate((providerId) => (window as any).__vlainaE2E.addModel({
        providerId,
        apiModelId: 'e2e-channel-b-model',
        name: 'E2E Channel B Model',
        selected: true,
      }), providerBId);
      await page.evaluate((providerId) => (window as any).__vlainaE2E.addModel({
        providerId,
        apiModelId: 'e2e-channel-c-model',
        name: 'E2E Channel C Model',
        selected: false,
      }), providerCId);

      await openSettings(page);
      await openAITab(page);

      await expect.poll(() => getCustomProviderNames(page), { timeout: 10_000 }).toEqual([
        'E2E Channel A',
        'E2E Channel B',
        'E2E Channel C',
      ]);

      await dragChannelToChannel(page, 'E2E Channel C', 'E2E Channel A');

      await expect.poll(() => getCustomProviderNames(page), { timeout: 10_000 }).toEqual([
        'E2E Channel C',
        'E2E Channel A',
        'E2E Channel B',
      ]);
      await expect.poll(() => getRenderedChannelNames(page), { timeout: 10_000 }).toEqual([
        expect.stringContaining('E2E Channel C'),
        expect.stringContaining('E2E Channel A'),
        expect.stringContaining('E2E Channel B'),
      ]);

      await page.locator('[data-settings-action="close"]').click();
      await setAppViewMode(page, 'chat');
      await page.getByRole('button', { name: /E2E Channel B Model/ }).click();
      await expect(page.locator('[data-model-selector-dropdown="true"]')).toBeVisible({ timeout: 10_000 });
      await expect.poll(() => getModelSelectorProviderNames(page), { timeout: 10_000 }).toEqual([
        'E2E Channel C',
        'E2E Channel A',
        'E2E Channel B',
      ]);

      await openSettings(page);
      await openAITab(page);
      await dragChannelToChannel(page, 'E2E Channel C', 'E2E Channel B');

      await expect.poll(() => getCustomProviderNames(page), { timeout: 10_000 }).toEqual([
        'E2E Channel A',
        'E2E Channel B',
        'E2E Channel C',
      ]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
