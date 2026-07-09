import { expect, test, type Page } from '@playwright/test';
import {
  CHAT_MESSAGE_SELECTOR,
  cleanupIsolatedElectron,
  createChatFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  setAppViewMode,
  waitForChatSession,
} from './notesE2E';

const ASSISTANT_SENTINEL = 'CHAT_FONT_SIZE_SCALING_SENTINEL';
const SHORT_USER_SENTINEL = 'CHAT_SHORT_USER_FONT_SIZE_SENTINEL';

function createLongUserMessage(): string {
  return Array.from({ length: 9 }, (_value, index) =>
    `CHAT_LONG_USER_FONT_SIZE_LINE_${index + 1}`,
  ).join('\n');
}

async function collectScaledTextMetrics(page: Page) {
  return page.evaluate(({ assistantSentinel, shortUserSentinel }) => {
    const readFontSize = (element: Element | null) =>
      element instanceof HTMLElement ? Number.parseFloat(getComputedStyle(element).fontSize) : 0;

    const assistant = Array.from(document.querySelectorAll<HTMLElement>(
      '[data-message-item="true"][data-role="assistant"]',
    )).find((element) => element.textContent?.includes(assistantSentinel)) ?? null;
    const assistantSurface = assistant?.querySelector<HTMLElement>('.markdown-surface') ?? null;
    const shortUserBubble = Array.from(document.querySelectorAll<HTMLElement>(
      '[data-message-item="true"][data-role="user"] [data-vlaina-markdown-font-size-surface="true"]',
    )).find((element) => element.textContent?.includes(shortUserSentinel)) ?? null;

    const scaledRoots = Array.from(document.querySelectorAll<HTMLElement>(
      '[data-vlaina-markdown-font-size-surface="true"], .markdown-surface',
    ));
    const candidates = new Set<HTMLElement>();
    for (const root of scaledRoots) {
      candidates.add(root);
      root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, p, li, blockquote, td, th, div, span')
        .forEach((element) => candidates.add(element));
    }

    const clippedScaledSurfaces = Array.from(candidates)
      .filter((element) => !element.closest('[data-chat-long-user-message="collapsed"]'))
      .map((element) => {
        const style = getComputedStyle(element);
        const clipsY = style.overflowY === 'hidden' || style.overflow === 'hidden';
        const clipsX = style.overflowX === 'hidden' || style.overflow === 'hidden';
        const verticalOverflow = clipsY && element.scrollHeight > element.clientHeight + 1;
        const horizontalOverflow = clipsX && element.scrollWidth > element.clientWidth + 1;
        return {
          tagName: element.tagName,
          className: String(element.className),
          text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
          overflow: style.overflow,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          verticalOverflow,
          horizontalOverflow,
        };
      })
      .filter((item) => item.verticalOverflow || item.horizontalOverflow);

    return {
      assistantBody: readFontSize(assistantSurface?.querySelector('p') ?? null),
      assistantHeadingOne: readFontSize(assistantSurface?.querySelector('h1') ?? null),
      assistantHeadingSix: readFontSize(assistantSurface?.querySelector('h6') ?? null),
      hasAssistantSurface: Boolean(assistantSurface),
      shortUserBubble: readFontSize(shortUserBubble),
      clippedScaledSurfaces,
    };
  }, { assistantSentinel: ASSISTANT_SENTINEL, shortUserSentinel: SHORT_USER_SENTINEL });
}

test.describe('chat font size scaling', () => {
  test.setTimeout(120_000);

  test('scales chat markdown text without unintended clipping', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('chat-font-size-scaling');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({ fontSize: 72 }));

      const fixture = await createChatFixture(page, {
        sessions: [{
          title: 'Chat Font Size Scaling',
          messages: [
            {
              role: 'user',
              content: SHORT_USER_SENTINEL,
            },
            {
              role: 'assistant',
              content: [
                '# Assistant Heading One',
                '',
                `Assistant paragraph ${ASSISTANT_SENTINEL}.`,
                '',
                '###### Assistant Heading Six',
              ].join('\n'),
            },
            {
              role: 'user',
              content: createLongUserMessage(),
            },
            {
              role: 'assistant',
              content: 'Expanded user message should not affect assistant rendering.',
            },
          ],
        }],
      });

      await setAppViewMode(page, 'chat');
      await waitForChatSession(page, {
        sessionId: fixture.sessionIds[0]!,
        minMessageCount: 4,
        sentinelText: ASSISTANT_SENTINEL,
      });
      await expect(page.locator(CHAT_MESSAGE_SELECTOR)).toHaveCount(4, { timeout: 30_000 });

      const collapsedToggle = page.locator('[data-chat-long-user-message-toggle="true"]').first();
      await expect(collapsedToggle).toHaveAttribute('aria-expanded', 'false', { timeout: 30_000 });

      await expect.poll(async () => {
        const metrics = await collectScaledTextMetrics(page);
        return metrics.hasAssistantSurface && metrics.assistantBody > 0 && metrics.shortUserBubble > 0;
      }, { timeout: 30_000 }).toBe(true);

      const collapsedMetrics = await collectScaledTextMetrics(page);
      expect(collapsedMetrics.hasAssistantSurface).toBe(true);
      expect(collapsedMetrics.assistantBody).toBe(72);
      expect(collapsedMetrics.shortUserBubble).toBe(72);
      expect(collapsedMetrics.assistantHeadingOne / collapsedMetrics.assistantBody).toBeCloseTo(2, 2);
      expect(collapsedMetrics.assistantHeadingSix / collapsedMetrics.assistantBody).toBeCloseTo(1, 2);
      expect(collapsedMetrics.clippedScaledSurfaces).toEqual([]);

      await collapsedToggle.click();
      await expect(collapsedToggle).toHaveAttribute('aria-expanded', 'true', { timeout: 10_000 });

      const expandedMetrics = await collectScaledTextMetrics(page);
      expect(expandedMetrics.clippedScaledSurfaces).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
