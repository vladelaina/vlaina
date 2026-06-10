import { expect, test, type Page } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

const SETTINGS_MODAL_SELECTOR = '[data-settings-modal="true"]';

async function openSettings(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('open-settings'));
  });
  await expect(page.locator(SETTINGS_MODAL_SELECTOR)).toBeVisible({ timeout: 30_000 });
}

async function openSettingsTab(page: Page, tab: 'markdown' | 'appearance' | 'language' | 'ai' | 'about') {
  await page.locator(`[data-settings-tab="${tab}"]`).click();
  await expect(page.locator(SETTINGS_MODAL_SELECTOR)).toHaveAttribute('data-settings-active-tab', tab, {
    timeout: 10_000,
  });
  await expect(page.locator(`[data-settings-tab-panel="${tab}"]`)).toBeVisible({ timeout: 10_000 });
}

async function getUnifiedData(page: Page) {
  return page.evaluate(() => (window as any).__vlainaE2E.getUnifiedData());
}

async function getUIState(page: Page) {
  return page.evaluate(() => (window as any).__vlainaE2E.getUIState());
}

async function clickAndExpectMarkdownSetting(
  page: Page,
  selector: string,
  reader: (data: any) => boolean,
) {
  const before = await getUnifiedData(page).then(reader);
  await page.locator(selector).click();
  await expect.poll(async () => getUnifiedData(page).then(reader), { timeout: 10_000 }).toBe(!before);
}

async function dragRangeInput(page: Page, selector: string, fromRatio: number, toRatio: number) {
  const slider = page.locator(selector);
  const box = await slider.boundingBox();
  if (!box) {
    throw new Error(`Range input not visible: ${selector}`);
  }

  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * fromRatio, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * toRatio, y, { steps: 8 });
  await page.mouse.up();
}

test.describe('settings modal interaction coverage', () => {
  test.setTimeout(120_000);

  test('drives core settings tabs through the real modal UI', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('settings-interaction-coverage');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await openSettings(page);
      await openSettingsTab(page, 'markdown');

      await clickAndExpectMarkdownSetting(
        page,
        '[data-settings-control="markdown-typewriter-mode"]',
        (data) => data.settings.markdown.typewriterMode === true,
      );
      await clickAndExpectMarkdownSetting(
        page,
        '[data-settings-control="markdown-body-line-numbers"]',
        (data) => data.settings.markdown.body?.showLineNumbers === true,
      );
      await clickAndExpectMarkdownSetting(
        page,
        '[data-settings-control="markdown-code-block-line-numbers"]',
        (data) => data.settings.markdown.codeBlock?.showLineNumbers === true,
      );

      await page.locator('[data-settings-image-storage-mode="vaultSubfolder"]').click();
      await expect(page.locator('[data-settings-control="image-vault-subfolder-name"]')).toBeVisible({
        timeout: 10_000,
      });
      await page.locator('[data-settings-control="image-vault-subfolder-name"]').fill('e2e-vault-assets');
      await page.locator('[data-settings-image-filename-format="sequence"]').click();
      await expect.poll(() => getUIState(page), { timeout: 10_000 }).toMatchObject({
        imageStorageMode: 'vaultSubfolder',
        imageVaultSubfolderName: 'e2e-vault-assets',
        imageFilenameFormat: 'sequence',
      });

      await openSettingsTab(page, 'appearance');
      const initialFontSize = await getUIState(page).then((state) => state.fontSize);
      await dragRangeInput(page, '[data-settings-control="appearance-font-size"]', 0.35, 0.8);
      await expect.poll(async () => getUIState(page).then((state) => state.fontSize), { timeout: 10_000 })
        .toBeGreaterThan(initialFontSize);

      await page.locator('[data-settings-color-mode="dark"]').click();
      await expect.poll(async () => {
        const data = await getUnifiedData(page);
        return data.settings.ui?.colorMode;
      }, { timeout: 10_000 }).toBe('dark');
      await expect.poll(async () => page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      ), { timeout: 10_000 }).toBe(true);

      await openSettingsTab(page, 'language');
      await page.locator('[data-settings-language-option="zh-CN"]').click();
      await expect.poll(async () => getUIState(page).then((state) => state.languagePreference), {
        timeout: 10_000,
      }).toBe('zh-CN');
      await expect.poll(async () => page.evaluate(() => document.documentElement.lang), {
        timeout: 10_000,
      }).toBe('zh-CN');

      await openSettingsTab(page, 'ai');
      await page.locator('[data-settings-ai-action="new-channel"]').first().click();
      await expect(page.locator('[data-settings-provider-field="name"]')).toBeVisible({ timeout: 10_000 });
      await page.locator('[data-settings-provider-field="name"]').fill('E2E Settings Channel');
      await page.locator('[data-settings-provider-field="api-host"]').fill('https://e2e-settings.invalid/v1');
      await page.locator('[data-settings-provider-field="api-key"]').fill('sk-e2e-settings-key');
      await page.locator('[data-settings-provider-action="toggle-api-key"]').click();
      await expect(page.locator('[data-settings-provider-field="api-key"]')).toHaveValue('sk-e2e-settings-key');
      await page.locator('[data-settings-provider-action="copy-api-key"]').click();
      await expect(page.locator('[data-settings-provider-action="copy-api-key"]')).toHaveAttribute(
        'data-copied',
        'true',
        { timeout: 10_000 },
      );

      await expect.poll(async () => {
        const data = await getUnifiedData(page);
        return data.ai.providers.find((provider: { id: string; name: string }) =>
          provider.id !== 'vlaina-managed' && provider.name === 'E2E Settings Channel'
        );
      }, { timeout: 10_000 }).toMatchObject({
        name: 'E2E Settings Channel',
        apiHost: 'https://e2e-settings.invalid/v1',
        apiKey: 'sk-e2e-settings-key',
        enabled: true,
      });

      const channelEnabledSwitch = page.locator('[data-settings-control="ai-channel-enabled"]').first();
      await channelEnabledSwitch.click();
      await expect.poll(async () => {
        const data = await getUnifiedData(page);
        return data.ai.providers.find((provider: { id: string; name: string }) =>
          provider.id !== 'vlaina-managed' && provider.name === 'E2E Settings Channel'
        )?.enabled;
      }, { timeout: 10_000 }).toBe(false);

      const channelCard = page.locator('[data-settings-ai-channel-card]').filter({ hasText: 'E2E Settings Channel' });
      await channelCard.hover();
      await channelCard.locator('[data-settings-ai-action="delete-channel"]').click();
      await expect(page.locator('[data-dialog-action="cancel"]')).toBeVisible({ timeout: 10_000 });
      await page.locator('[data-dialog-action="cancel"]').click();
      await expect.poll(async () => {
        const data = await getUnifiedData(page);
        return data.ai.providers.some((provider: { id: string; name: string }) =>
          provider.id !== 'vlaina-managed' && provider.name === 'E2E Settings Channel'
        );
      }, { timeout: 10_000 }).toBe(true);

      await channelCard.hover();
      await channelCard.locator('[data-settings-ai-action="delete-channel"]').click();
      await page.locator('[data-dialog-action="confirm"]').click();
      await expect.poll(async () => {
        const data = await getUnifiedData(page);
        return data.ai.providers.some((provider: { id: string; name: string }) =>
          provider.id !== 'vlaina-managed' && provider.name === 'E2E Settings Channel'
        );
      }, { timeout: 10_000 }).toBe(false);

      await page.locator('[data-settings-action="close"]').click();
      await expect(page.locator(SETTINGS_MODAL_SELECTOR)).toHaveCount(0, { timeout: 10_000 });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
