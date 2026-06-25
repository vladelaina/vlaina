import { expect, test } from '@playwright/test';
import http from 'node:http';
import {
  CHAT_COMPOSER_TEXTAREA_SELECTOR,
  CHAT_MESSAGE_SELECTOR,
  CHAT_SCROLLABLE_SELECTOR,
  CHAT_VIEW_SELECTOR,
  cleanupIsolatedElectron,
  createChatFixture,
  createChatModelFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  setAppViewMode,
  waitForChatSession,
} from './notesE2E';

type ShortPromptAnchorSample = {
  assistantText: string;
  messageCount: number;
  scrollHeight: number;
  scrollTop: number;
  userBottomOffset: number | null;
  userText: string;
  userTopOffset: number | null;
};

async function createDelayedProviderServer(): Promise<{
  close: () => Promise<void>;
  url: string;
}> {
  const server = http.createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== 'POST' || !request.url?.endsWith('/chat/completions')) {
      response.writeHead(404);
      response.end();
      return;
    }

    request.resume();
    request.on('end', () => {
      response.writeHead(200, {
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8',
      });

      const timer = setTimeout(() => {
        response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'hello from e2e' } }] })}\n\n`);
        response.write('data: [DONE]\n\n');
        response.end();
      }, 900);

      response.on('close', () => clearTimeout(timer));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to allocate delayed provider port.');
  }

  return {
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
    url: `http://127.0.0.1:${address.port}/v1`,
  };
}

async function startShortPromptAnchorProbe(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const samples: ShortPromptAnchorSample[] = [];
    let animationFrameId = 0;

    const readSample = () => {
      const scrollRoot = document.querySelector<HTMLElement>('[data-chat-scrollable="true"]');
      if (!scrollRoot) {
        return;
      }

      const scrollRect = scrollRoot.getBoundingClientRect();
      const messages = Array.from(document.querySelectorAll<HTMLElement>('[data-message-item="true"]'));
      const userMessage = messages.find((message) =>
        message.dataset.role === 'user' &&
        (message.textContent ?? '').trim() === 'hi'
      ) ?? null;
      const assistantMessage = messages.find((message) => message.dataset.role === 'assistant') ?? null;
      const userRect = userMessage?.getBoundingClientRect() ?? null;

      samples.push({
        assistantText: assistantMessage?.textContent ?? '',
        messageCount: messages.length,
        scrollHeight: scrollRoot.scrollHeight,
        scrollTop: scrollRoot.scrollTop,
        userBottomOffset: userRect ? userRect.bottom - scrollRect.top : null,
        userText: userMessage?.textContent?.trim() ?? '',
        userTopOffset: userRect ? userRect.top - scrollRect.top : null,
      });
    };

    const tick = () => {
      readSample();
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    (window as any).__vlainaShortPromptAnchorProbe = {
      stop: () => {
        cancelAnimationFrame(animationFrameId);
        readSample();
        return samples;
      },
    };
  });
}

function createMeasuredHistoryMessages(count: number) {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (let index = 0; index < count; index += 1) {
    messages.push({
      role: 'user',
      content: `Previous user prompt ${index}`,
    });
    messages.push({
      role: 'assistant',
      content: [
        `### Previous assistant response ${index}`,
        '',
        'This response has enough markdown structure and wrapping text to make estimated and measured row heights diverge slightly.',
        '',
        '- A list item with medium length text.',
        '- Another item that wraps at normal chat width.',
        '',
        '```ts',
        `const previousResponseIndex = ${index};`,
        '```',
      ].join('\n'),
    });
  }
  return messages;
}

async function scrollChatToBottom(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const scrollRoot = document.querySelector<HTMLElement>('[data-chat-scrollable="true"]');
    if (!scrollRoot) {
      return;
    }
    scrollRoot.scrollTop = scrollRoot.scrollHeight;
    scrollRoot.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await page.waitForTimeout(120);
}

async function scrollChatToTop(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const scrollRoot = document.querySelector<HTMLElement>('[data-chat-scrollable="true"]');
    if (!scrollRoot) {
      return;
    }
    scrollRoot.scrollTop = 0;
    scrollRoot.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await page.waitForTimeout(120);
}

test.describe('chat short prompt anchoring', () => {
  test.setTimeout(120_000);

  test('keeps a first short sent prompt pinned as a single row at the top while awaiting response', async () => {
    const provider = await createDelayedProviderServer();
    const { app, userDataRoot } = await launchIsolatedElectron('chat-short-prompt-anchor');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await createChatModelFixture(page, {
        apiHost: provider.url,
        apiModelId: 'e2e-short-prompt-anchor-model',
        providerName: 'E2E Short Prompt Anchor Provider',
      });
      await setAppViewMode(page, 'chat');
      await expect(page.locator(CHAT_VIEW_SELECTOR)).toBeVisible({ timeout: 30_000 });

      await startShortPromptAnchorProbe(page);

      const textarea = page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR);
      await expect(textarea).toBeVisible({ timeout: 30_000 });
      await textarea.fill('hi');
      await textarea.press('Enter');
      await expect(textarea).toHaveValue('', { timeout: 10_000 });

      await expect(page.locator(`${CHAT_MESSAGE_SELECTOR}[data-role="user"]`, { hasText: 'hi' }))
        .toBeVisible({ timeout: 30_000 });
      await expect(page.locator(`${CHAT_MESSAGE_SELECTOR}[data-role="assistant"]`, { hasText: 'hello from e2e' }))
        .toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(200);

      const samples = await page.evaluate(() =>
        (window as any).__vlainaShortPromptAnchorProbe.stop() as ShortPromptAnchorSample[]
      );
      const visibleUserSamples = samples.filter((sample) => sample.userTopOffset !== null);
      const settledSamples = visibleUserSamples.slice(Math.max(0, visibleUserSamples.length - 12));
      const splitSamples = settledSamples.filter((sample) =>
        sample.userTopOffset !== null &&
        sample.userBottomOffset !== null &&
        (sample.userTopOffset < -1 || sample.userBottomOffset <= 1)
      );
      const topOffsets = settledSamples.map((sample) => sample.userTopOffset ?? 0);

      console.info('[chat-short-prompt-anchor]', {
        firstVisible: visibleUserSamples[0],
        lastSamples: settledSamples,
      });

      expect(visibleUserSamples.length).toBeGreaterThan(0);
      expect(splitSamples).toEqual([]);
      expect(Math.max(...topOffsets.map((offset) => Math.abs(offset)))).toBeLessThanOrEqual(2);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
      await provider.close();
    }
  });

  test('keeps a short sent prompt pinned at the top after a long measured conversation', async () => {
    const provider = await createDelayedProviderServer();
    const { app, userDataRoot } = await launchIsolatedElectron('chat-short-prompt-anchor-history');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await createChatModelFixture(page, {
        apiHost: provider.url,
        apiModelId: 'e2e-short-prompt-anchor-history-model',
        providerName: 'E2E Short Prompt Anchor History Provider',
      });
      const fixture = await createChatFixture(page, {
        sessions: [{
          title: 'E2E Short Prompt Anchor History',
          messages: createMeasuredHistoryMessages(18),
        }],
      });
      await setAppViewMode(page, 'chat');
      await waitForChatSession(page, {
        sessionId: fixture.sessionIds[0]!,
        minMessageCount: 36,
      });
      await scrollChatToBottom(page);
      await startShortPromptAnchorProbe(page);

      const textarea = page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR);
      await expect(textarea).toBeVisible({ timeout: 30_000 });
      await textarea.fill('hi');
      await textarea.press('Enter');
      await expect(textarea).toHaveValue('', { timeout: 10_000 });

      await expect(page.locator(`${CHAT_MESSAGE_SELECTOR}[data-role="user"]`, { hasText: 'hi' }))
        .toBeVisible({ timeout: 30_000 });
      await expect(page.locator(`${CHAT_MESSAGE_SELECTOR}[data-role="assistant"]`, { hasText: 'hello from e2e' }))
        .toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(200);

      const samples = await page.evaluate(() =>
        (window as any).__vlainaShortPromptAnchorProbe.stop() as ShortPromptAnchorSample[]
      );
      const visibleUserSamples = samples.filter((sample) => sample.userTopOffset !== null);
      const settledSamples = visibleUserSamples.slice(Math.max(0, visibleUserSamples.length - 12));
      const splitSamples = settledSamples.filter((sample) =>
        sample.userTopOffset !== null &&
        sample.userBottomOffset !== null &&
        (sample.userTopOffset < -1 || sample.userBottomOffset <= 1)
      );
      const topOffsets = settledSamples.map((sample) => sample.userTopOffset ?? 0);

      console.info('[chat-short-prompt-anchor-history]', {
        firstVisible: visibleUserSamples[0],
        lastSamples: settledSamples,
      });

      expect(visibleUserSamples.length).toBeGreaterThan(0);
      expect(splitSamples).toEqual([]);
      expect(Math.max(...topOffsets.map((offset) => Math.abs(offset)))).toBeLessThanOrEqual(2);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
      await provider.close();
    }
  });

  test('anchors a short prompt sent while scrolled away from the bottom of a long conversation', async () => {
    const provider = await createDelayedProviderServer();
    const { app, userDataRoot } = await launchIsolatedElectron('chat-short-prompt-anchor-detached-history');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await createChatModelFixture(page, {
        apiHost: provider.url,
        apiModelId: 'e2e-short-prompt-anchor-detached-model',
        providerName: 'E2E Short Prompt Anchor Detached Provider',
      });
      const fixture = await createChatFixture(page, {
        sessions: [{
          title: 'E2E Short Prompt Anchor Detached History',
          messages: createMeasuredHistoryMessages(24),
        }],
      });
      await setAppViewMode(page, 'chat');
      await waitForChatSession(page, {
        sessionId: fixture.sessionIds[0]!,
        minMessageCount: 48,
      });
      await scrollChatToTop(page);
      await startShortPromptAnchorProbe(page);

      const textarea = page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR);
      await expect(textarea).toBeVisible({ timeout: 30_000 });
      await textarea.fill('hi');
      await textarea.press('Enter');
      await expect(textarea).toHaveValue('', { timeout: 10_000 });

      await expect(page.locator(`${CHAT_MESSAGE_SELECTOR}[data-role="user"]`, { hasText: 'hi' }))
        .toBeVisible({ timeout: 30_000 });
      await expect(page.locator(`${CHAT_MESSAGE_SELECTOR}[data-role="assistant"]`, { hasText: 'hello from e2e' }))
        .toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(200);

      const samples = await page.evaluate(() =>
        (window as any).__vlainaShortPromptAnchorProbe.stop() as ShortPromptAnchorSample[]
      );
      const visibleUserSamples = samples.filter((sample) => sample.userTopOffset !== null);
      const settledSamples = visibleUserSamples.slice(Math.max(0, visibleUserSamples.length - 12));
      const splitSamples = settledSamples.filter((sample) =>
        sample.userTopOffset !== null &&
        sample.userBottomOffset !== null &&
        (sample.userTopOffset < -1 || sample.userBottomOffset <= 1)
      );
      const topOffsets = settledSamples.map((sample) => sample.userTopOffset ?? 0);

      console.info('[chat-short-prompt-anchor-detached-history]', {
        firstVisible: visibleUserSamples[0],
        lastSamples: settledSamples,
      });

      expect(visibleUserSamples.length).toBeGreaterThan(0);
      expect(splitSamples).toEqual([]);
      expect(Math.max(...topOffsets.map((offset) => Math.abs(offset)))).toBeLessThanOrEqual(2);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
      await provider.close();
    }
  });
});
