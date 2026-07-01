import { expect, test } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

test.describe('account login focus', () => {
  test.setTimeout(60_000);

  test('focuses the email input after opening login from the account menu', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('account-login-focus');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await page.getByRole('button', { name: 'vlaina' }).click();
      await page.getByRole('button', { name: /Sign In|登录|登入/i }).click();

      const emailInput = page.locator('input[autocomplete="email"]').first();
      await expect(emailInput).toBeVisible({ timeout: 10_000 });
      await expect(emailInput).toBeFocused();
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
