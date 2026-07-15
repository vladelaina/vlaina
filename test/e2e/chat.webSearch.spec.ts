import { expect, test, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { E2E_DEV_SERVER_URL } from './notesE2E';

async function waitForE2EBridge(page: Page) {
  await page.waitForFunction(() => Boolean((window as any).__vlainaE2E));
  await page.evaluate(() => (window as any).__vlainaE2E.waitForUnifiedLoaded());
}

async function launchIsolatedElectron(): Promise<{
  app: ElectronApplication;
  userDataDir: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vlaina-chat-search-e2e-'));
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

async function openPreparedChatPage(): Promise<{
  app: ElectronApplication;
  page: Page;
  userDataDir: string;
}> {
  const { app, userDataDir } = await launchIsolatedElectron();
  const page = await app.firstWindow();
  await waitForE2EBridge(page);
  await page.evaluate(() => (window as any).__vlainaE2E.prepareChatWebSearchE2E());
  await expect(page.locator('[data-chat-input="true"] textarea')).toBeVisible();
  return { app, page, userDataDir };
}

async function cleanup(app: ElectronApplication, userDataDir: string): Promise<void> {
  await closeElectron(app);
  await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}

async function enableWebSearchFromComposer(page: Page): Promise<void> {
  await page.locator('[data-chat-input-action="open-actions"]').click();
  await page.locator('[data-chat-input-action="enable-web-search"]').click();
  await expect(page.locator('[data-chat-input-action="disable-web-search"]')).toBeVisible();
}

async function sendComposerMessage(page: Page, text: string): Promise<void> {
  const composer = page.locator('[data-chat-input="true"] textarea');
  await composer.fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
}

test.describe('chat web search user flows', () => {
  test.setTimeout(90_000);

  test('toggles web search from the composer and persists the setting', async () => {
    const { app, page, userDataDir } = await openPreparedChatPage();

    try {
      await expect(page.locator('[data-chat-input-action="disable-web-search"]')).toHaveCount(0);
      await expect.poll(async () => page.evaluate(() => (window as any).__vlainaE2E.getChatState().webSearchEnabled))
        .toBe(false);

      await enableWebSearchFromComposer(page);
      await expect(page.locator('[data-chat-input-action="disable-web-search"]')).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(async () => page.evaluate(() => (window as any).__vlainaE2E.getUnifiedData().ai?.webSearchEnabled))
        .toBe(true);

      await page.locator('[data-chat-input-action="disable-web-search"]').click();
      await expect(page.locator('[data-chat-input-action="disable-web-search"]')).toHaveCount(0);
      await expect.poll(async () => page.evaluate(() => (window as any).__vlainaE2E.getUnifiedData().ai?.webSearchEnabled))
        .toBe(false);
    } finally {
      await cleanup(app, userDataDir);
    }
  });

  test('sends searched and non-searched prompts through the same composer', async () => {
    const { app, page, userDataDir } = await openPreparedChatPage();

    try {
      await enableWebSearchFromComposer(page);
      const searchedAnswer = 'The browser release notes mention a search quality fix.';
      const webSearchStatuses = [
        { phase: 'searching', query: 'latest browser release notes' },
        {
          phase: 'results',
          query: 'latest browser release notes',
          results: [
            {
              title: 'Browser Release Notes',
              url: 'https://example.com/browser-release-notes',
              snippet: 'Release notes summary.',
              publishedAt: null,
            },
          ],
          metrics: { resultCount: 1, durationMs: 25 },
        },
        {
          phase: 'complete',
          urls: ['https://example.com/browser-release-notes'],
          metrics: { successCount: 1, durationMs: 41 },
        },
      ];

      await page.evaluate(({ final, statuses }) => (window as any).__vlainaE2E.enqueueChatMockResponse({
        final,
        webSearchStatuses: statuses,
        apiTranscript: [{ role: 'assistant', content: 'The browser release notes mention a search quality fix.' }],
      }), { final: searchedAnswer, statuses: webSearchStatuses });
      await sendComposerMessage(page, 'Search the latest browser release notes');

      await expect(page.getByText('Sources read')).toBeVisible();
      await expect(page.getByRole('link', { name: /Browser Release Notes/ })).toBeVisible();
      await expect(page.getByText('The browser release notes mention a search quality fix.')).toBeVisible();

      await page.locator('[data-chat-input-action="disable-web-search"]').click();
      await page.evaluate(() => (window as any).__vlainaE2E.enqueueChatMockResponse({
        final: 'Plain answer without web search.',
        apiTranscript: [{ role: 'assistant', content: 'Plain answer without web search.' }],
      }));
      await sendComposerMessage(page, 'Answer without searching');
      await expect(page.getByText('Plain answer without web search.')).toBeVisible();

      await expect.poll(async () => page.evaluate(() => {
        const requests = (window as any).__vlainaE2E.getChatMockRequests();
        return requests.filter((request: { content: unknown }) =>
          request.content === 'Search the latest browser release notes' ||
          request.content === 'Answer without searching'
        );
      }))
        .toMatchObject([
          { webSearchEnabled: true },
          { webSearchEnabled: false },
        ]);
    } finally {
      await cleanup(app, userDataDir);
    }
  });

  test('stops an in-flight web search response from the composer', async () => {
    const { app, page, userDataDir } = await openPreparedChatPage();

    try {
      await enableWebSearchFromComposer(page);
      await page.evaluate((status) => (window as any).__vlainaE2E.enqueueChatMockResponse({
        webSearchStatuses: [status],
        hold: true,
      }), { phase: 'searching', query: 'slow search query' });

      await sendComposerMessage(page, 'Search slowly, then stop');
      await expect(page.getByText('Searching')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible();
      await expect.poll(async () => page.evaluate(() => (window as any).__vlainaE2E.getChatMockPendingRequestIds().length))
        .toBe(1);

      await page.getByRole('button', { name: 'Stop response' }).click();
      await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
      await expect.poll(async () => page.evaluate(() => (window as any).__vlainaE2E.getChatState().generating))
        .toBe(false);
      await expect.poll(async () => page.evaluate(() => (window as any).__vlainaE2E.getChatMockPendingRequestIds().length))
        .toBe(0);
      await expect.poll(async () => page.evaluate(() => (window as any).__vlainaE2E.getChatMockRequests()))
        .toMatchObject([{ webSearchEnabled: true }]);
    } finally {
      await cleanup(app, userDataDir);
    }
  });
});
