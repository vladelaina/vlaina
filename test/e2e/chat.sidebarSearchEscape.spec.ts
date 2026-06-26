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

const CHAT_SEARCH_INPUT_SELECTOR = '[data-sidebar-surface="true"] input[type="text"]';

async function fillChatSidebarSearch(page: Page, query: string): Promise<void> {
  const input = page.locator(CHAT_SEARCH_INPUT_SELECTOR).first();
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(query);
}

async function getSearchAndFocusState(page: Page) {
  return page.evaluate((searchInputSelector) => {
    const searchInput = document.querySelector<HTMLInputElement>(searchInputSelector);
    const active = document.activeElement;
    return {
      hasSearchInput: Boolean(searchInput),
      searchInputVisible: searchInput
        ? getComputedStyle(searchInput).visibility !== 'hidden' &&
          searchInput.getBoundingClientRect().width > 0 &&
          searchInput.getBoundingClientRect().height > 0
        : false,
      searchValue: searchInput?.value ?? null,
      activeTagName: active instanceof HTMLElement ? active.tagName : null,
      activeText: active instanceof HTMLElement ? active.textContent?.trim().slice(0, 80) ?? '' : '',
      activeMatchesSearchInput: active === searchInput,
    };
  }, CHAT_SEARCH_INPUT_SELECTOR);
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

      console.info('[chat-sidebar-search-escape-before-close]', await getSearchAndFocusState(page));

      await page.keyboard.press('Escape');
      await expect.poll(() => getSearchAndFocusState(page), { timeout: 10_000 }).toMatchObject({
        searchValue: '',
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
