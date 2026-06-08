import { expect, test } from '@playwright/test';
import {
  CHAT_COMPOSER_TEXTAREA_SELECTOR,
  CHAT_MESSAGE_SELECTOR,
  CHAT_SCROLLABLE_SELECTOR,
  CHAT_SESSION_ROW_SELECTOR,
  CHAT_VIEW_SELECTOR,
  cleanupIsolatedElectron,
  createChatFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  measureChatScrollFrames,
  setAppViewMode,
  waitForChatSession,
} from './notesE2E';

function createLongChatMessages(sectionCount: number) {
  const messages: Array<{ role: 'user' | 'assistant'; content: string; modelId?: string }> = [];
  for (let index = 0; index < sectionCount; index += 1) {
    messages.push({
      role: 'user',
      content: [
        `Long chat user prompt ${index}`,
        '',
        `Please analyze item ${index} with enough detail to exercise layout and virtualization.`,
      ].join('\n'),
    });
    messages.push({
      role: 'assistant',
      content: [
        `## Long Chat Section ${index}`,
        '',
        `Assistant rendered markdown sentinel ${index}.`,
        '',
        '- Bullet alpha',
        '- Bullet beta',
        '',
        '| Column | Value |',
        '| --- | --- |',
        `| Index | ${index} |`,
        '',
        '```ts',
        `const longChatIndex = ${index};`,
        '```',
        '',
        `Final assistant sentence for section ${index}.`,
      ].join('\n'),
    });
  }
  messages.push({
    role: 'assistant',
    content: 'LONG_CHAT_FINAL_SENTINEL rendered at the tail of the long conversation.',
  });
  return messages;
}

async function scrollChatTo(page: import('@playwright/test').Page, position: 'top' | 'middle' | 'bottom') {
  await page.evaluate((nextPosition) => {
    const scrollRoot = document.querySelector<HTMLElement>('[data-chat-scrollable="true"]');
    if (!scrollRoot) return;
    const maxScrollTop = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
    scrollRoot.scrollTop = nextPosition === 'top'
      ? 0
      : nextPosition === 'bottom'
        ? maxScrollTop
        : Math.round(maxScrollTop / 2);
    scrollRoot.dispatchEvent(new Event('scroll', { bubbles: true }));
  }, position);
  await page.waitForTimeout(80);
}

test.describe('chat session list and long conversation rendering', () => {
  test.setTimeout(120_000);

  test('switches sessions from the left sidebar and keeps long conversations scrollable', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('chat-session-interaction');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const fixture = await createChatFixture(page, {
        activeSessionIndex: 0,
        sessions: [
          {
            title: 'E2E Long Chat Alpha',
            messages: createLongChatMessages(56),
          },
          {
            title: 'E2E Short Chat Beta',
            messages: [
              { role: 'user', content: 'Beta user prompt sentinel.' },
              { role: 'assistant', content: 'BETA_CHAT_SENTINEL rendered response.' },
            ],
          },
        ],
      });

      await setAppViewMode(page, 'chat');
      await expect(page.locator(CHAT_VIEW_SELECTOR)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(CHAT_SESSION_ROW_SELECTOR, { hasText: 'E2E Long Chat Alpha' })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator(CHAT_SESSION_ROW_SELECTOR, { hasText: 'E2E Short Chat Beta' })).toBeVisible();
      await expect(page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR)).toBeVisible();

      await waitForChatSession(page, {
        sessionId: fixture.sessionIds[0]!,
        minMessageCount: 100,
      });

      const initialMetrics = await page.evaluate(() => {
        const scrollRoot = document.querySelector<HTMLElement>('[data-chat-scrollable="true"]');
        return {
          visibleMessages: document.querySelectorAll('[data-message-item="true"]').length,
          totalMessages: (window as any).__vlainaE2E.getChatState().messages[(window as any).__vlainaE2E.getChatState().currentSessionId]?.length ?? 0,
          scrollHeight: scrollRoot?.scrollHeight ?? 0,
          clientHeight: scrollRoot?.clientHeight ?? 0,
        };
      });
      expect(initialMetrics.totalMessages).toBeGreaterThan(100);
      expect(initialMetrics.scrollHeight).toBeGreaterThan(initialMetrics.clientHeight);
      expect(initialMetrics.visibleMessages).toBeGreaterThan(0);
      expect(initialMetrics.visibleMessages).toBeLessThan(initialMetrics.totalMessages);

      await scrollChatTo(page, 'bottom');
      await expect(page.locator(CHAT_VIEW_SELECTOR)).toContainText('LONG_CHAT_FINAL_SENTINEL', {
        timeout: 10_000,
      });

      const scrollMetrics = await measureChatScrollFrames(page, 36);
      console.info('[chat-long-session-scroll]', scrollMetrics);
      expect(scrollMetrics).not.toBeNull();
      expect(scrollMetrics!.maxFrameMs).toBeLessThan(500);

      const betaRow = page.locator(CHAT_SESSION_ROW_SELECTOR, { hasText: 'E2E Short Chat Beta' }).first();
      const betaSwitchStartedAt = Date.now();
      await betaRow.click();
      await waitForChatSession(page, {
        sessionId: fixture.sessionIds[1]!,
        minMessageCount: 2,
        sentinelText: 'BETA_CHAT_SENTINEL',
      });
      const betaSwitchMs = Date.now() - betaSwitchStartedAt;
      await expect(page.locator(CHAT_VIEW_SELECTOR)).toContainText('BETA_CHAT_SENTINEL');
      await expect(page.locator(CHAT_MESSAGE_SELECTOR)).toHaveCount(2);

      const alphaRow = page.locator(CHAT_SESSION_ROW_SELECTOR, { hasText: 'E2E Long Chat Alpha' }).first();
      const alphaSwitchStartedAt = Date.now();
      await alphaRow.click();
      await waitForChatSession(page, {
        sessionId: fixture.sessionIds[0]!,
        minMessageCount: 100,
      });
      const alphaSwitchMs = Date.now() - alphaSwitchStartedAt;
      await scrollChatTo(page, 'top');
      await expect(page.locator(CHAT_VIEW_SELECTOR)).toContainText('Long Chat Section 0', {
        timeout: 10_000,
      });

      const switchMetrics = await page.evaluate(() => {
        const state = (window as any).__vlainaE2E.getChatState();
        const scrollRoot = document.querySelector<HTMLElement>('[data-chat-scrollable="true"]');
        return {
          currentSessionId: state.currentSessionId,
          visibleMessages: document.querySelectorAll('[data-message-item="true"]').length,
          scrollHeight: scrollRoot?.scrollHeight ?? 0,
          clientHeight: scrollRoot?.clientHeight ?? 0,
        };
      });
      console.info('[chat-session-switch]', {
        betaSwitchMs,
        alphaSwitchMs,
        switchMetrics,
      });

      expect(betaSwitchMs).toBeLessThan(5_000);
      expect(alphaSwitchMs).toBeLessThan(5_000);
      expect(switchMetrics.currentSessionId).toBe(fixture.sessionIds[0]);
      expect(switchMetrics.scrollHeight).toBeGreaterThan(switchMetrics.clientHeight);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
