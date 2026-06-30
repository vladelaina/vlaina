import { expect, test, type Page } from '@playwright/test';
import {
  CHAT_COMPOSER_TEXTAREA_SELECTOR,
  CHAT_SESSION_ROW_SELECTOR,
  cleanupIsolatedElectron,
  createChatFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  setAppViewMode,
  waitForChatSession,
} from './notesE2E';

function getChatSidebarSurface(page: Page) {
  return page
    .locator('[data-sidebar-surface="true"]')
    .filter({ has: page.locator(CHAT_SESSION_ROW_SELECTOR) })
    .first();
}

async function fillChatSidebarSearch(page: Page, query: string): Promise<void> {
  const input = getChatSidebarSurface(page).locator('input[type="text"]').first();
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(query);
}

async function getSearchValue(page: Page) {
  const input = getChatSidebarSurface(page).locator('input[type="text"]').first();
  return input.inputValue();
}

test.describe('chat sidebar search Escape behavior', () => {
  test.setTimeout(120_000);

  test('closes search with Escape after chat input takes focus away from sidebar search', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('chat-sidebar-search-escape');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const fixture = await createChatFixture(page, {
        sessions: [
          {
            title: 'E2E Sidebar Search Target With A Very Long Session Title For Wrapping',
            messages: [
              {
                role: 'user',
                content: 'E2E sidebar search user prompt.',
              },
              {
                role: 'assistant',
                content: 'SIDEBAR_SEARCH_ESCAPE_SENTINEL assistant response.',
              },
            ],
          },
        ],
      });

      await setAppViewMode(page, 'chat');
      await waitForChatSession(page, {
        sessionId: fixture.sessionIds[0]!,
        minMessageCount: 2,
        sentinelText: 'SIDEBAR_SEARCH_ESCAPE_SENTINEL',
      });

      const composer = page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR);
      await expect(composer).toBeVisible({ timeout: 30_000 });
      await composer.focus();
      await page.keyboard.press('Control+Shift+F');
      await fillChatSidebarSearch(page, 'Sidebar Search Target');
      await expect(page.locator(CHAT_SESSION_ROW_SELECTOR, { hasText: 'E2E Sidebar Search Target' })).toBeVisible({
        timeout: 10_000,
      });

      await composer.focus();
      await expect(composer).toBeFocused({ timeout: 10_000 });

      await composer.press('Escape');
      await expect.poll(() => getSearchValue(page), { timeout: 10_000 }).toBe('');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
