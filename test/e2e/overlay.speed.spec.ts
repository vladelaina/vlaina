import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

const SETTINGS_MODAL_SELECTOR = '[data-settings-modal="true"]';

async function getMaxMotionDurationMs(locator: Locator) {
  return locator.evaluate((element) => {
    const parseCssTimeMs = (value: string) =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          if (part.endsWith('ms')) return Number.parseFloat(part);
          if (part.endsWith('s')) return Number.parseFloat(part) * 1000;
          return Number.parseFloat(part) || 0;
        });

    const style = window.getComputedStyle(element);
    return Math.max(
      0,
      ...parseCssTimeMs(style.transitionDuration),
      ...parseCssTimeMs(style.animationDuration),
    );
  });
}

async function openSettings(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('open-settings'));
  });
  await expect(page.locator(SETTINGS_MODAL_SELECTOR)).toBeVisible({ timeout: 30_000 });
}

test.describe('overlay entrance speed', () => {
  test.setTimeout(60_000);

  test('keeps common overlays and collapsed sidebar peek snappy', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('overlay-entrance-speed');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1100, height: 760 });

      await page.getByRole('button', { name: 'vlaina' }).click();
      const userMenu = page.locator('.user-menu-popover');
      await expect(userMenu).toBeVisible({ timeout: 10_000 });
      await expect.poll(() => getMaxMotionDurationMs(userMenu), {
        message: 'user menu should use the fast popover duration',
      }).toBeLessThanOrEqual(90);

      await page.getByRole('button', { name: /Sign In|登录|登入/i }).click();
      const loginDialog = page.getByRole('dialog').first();
      await expect(loginDialog).toBeVisible({ timeout: 10_000 });
      await expect.poll(() => getMaxMotionDurationMs(loginDialog), {
        message: 'login dialog should use the fast dialog duration',
      }).toBeLessThanOrEqual(90);
      await page.keyboard.press('Escape');
      await expect(loginDialog).toBeHidden({ timeout: 10_000 });

      await openSettings(page);
      const settingsModal = page.locator(SETTINGS_MODAL_SELECTOR);
      await expect.poll(() => getMaxMotionDurationMs(settingsModal), {
        message: 'settings modal shell should avoid slow entrance transitions',
      }).toBeLessThanOrEqual(110);
      await page.locator('[data-settings-action="close"]').click();
      await expect(settingsModal).toBeHidden({ timeout: 10_000 });

      await page.locator('.sidebar-user-header').hover();
      await page.locator('.sidebar-user-header-collapse').click();
      const peekSidebar = page.locator('[data-shell-sidebar-peek="true"]');
      await page.mouse.move(2, 120);
      await expect(peekSidebar).toHaveAttribute('data-open', 'true');
      await expect.poll(() => getMaxMotionDurationMs(peekSidebar), {
        message: 'collapsed sidebar peek should use the faster shell duration',
      }).toBeLessThanOrEqual(110);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
