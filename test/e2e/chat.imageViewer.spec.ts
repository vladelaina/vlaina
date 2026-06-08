import { expect, test, type Page } from '@playwright/test';
import {
  CHAT_IMAGE_VIEWER_SURFACE_SELECTOR,
  CHAT_VIEW_SELECTOR,
  cleanupIsolatedElectron,
  createChatFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  setAppViewMode,
  waitForChatSession,
} from './notesE2E';

const PNG_A =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const PNG_B =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/l4KC+A4AAAAASUVORK5CYII=';

async function getViewerImageSrc(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const image = document.querySelector<HTMLImageElement>(
      '[data-chat-image-viewer-surface="true"] .reactEasyCrop_Image',
    );
    return image?.getAttribute('src') ?? null;
  });
}

async function clickViewerSideNav(page: Page, side: 'left' | 'right'): Promise<void> {
  const target = await page.evaluate((targetSide) => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(
      '[data-chat-image-viewer-surface="true"] button[data-chat-image-viewer-control="true"]',
    ));
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const button = buttons.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      const inMiddleBand = rect.top > viewportHeight * 0.2 && rect.bottom < viewportHeight * 0.8;
      const onSide = targetSide === 'right'
        ? rect.left > viewportWidth * 0.65
        : rect.right < viewportWidth * 0.35;
      return inMiddleBand && onSide && rect.width > 0 && rect.height > 0;
    });
    if (!button) {
      return null;
    }
    const rect = button.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, side);

  if (!target) {
    throw new Error(`Could not find ${side} image viewer navigation button`);
  }

  await page.mouse.click(target.x, target.y);
}

test.describe('chat image viewer interaction', () => {
  test.setTimeout(120_000);

  test('opens assistant images instantly and navigates the preview gallery', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('chat-image-viewer');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const fixture = await createChatFixture(page, {
        sessions: [
          {
            title: 'E2E Image Viewer Chat',
            messages: [
              {
                role: 'assistant',
                content: [
                  'IMAGE_VIEWER_CHAT_SENTINEL before images.',
                  '',
                  `![First e2e image](<${PNG_A}>)`,
                  '',
                  `![Second e2e image](<${PNG_B}>)`,
                  '',
                  'IMAGE_VIEWER_CHAT_SENTINEL after images.',
                ].join('\n'),
              },
            ],
          },
        ],
      });

      await setAppViewMode(page, 'chat');
      await waitForChatSession(page, {
        sessionId: fixture.sessionIds[0]!,
        minMessageCount: 1,
        sentinelText: 'IMAGE_VIEWER_CHAT_SENTINEL after images',
      });

      const firstImage = page.locator(`${CHAT_VIEW_SELECTOR} img[alt="First e2e image"]`).first();
      const secondImage = page.locator(`${CHAT_VIEW_SELECTOR} img[alt="Second e2e image"]`).first();
      await expect(firstImage).toBeVisible({ timeout: 30_000 });
      await expect(secondImage).toBeVisible({ timeout: 30_000 });

      const openStartedAt = Date.now();
      await firstImage.click();
      await expect(page.locator(CHAT_IMAGE_VIEWER_SURFACE_SELECTOR)).toBeVisible({ timeout: 10_000 });
      await expect.poll(() => getViewerImageSrc(page), { timeout: 10_000 }).toContain(PNG_A);
      const openMs = Date.now() - openStartedAt;

      await expect.poll(async () => page.locator(
        `${CHAT_IMAGE_VIEWER_SURFACE_SELECTOR} button[data-chat-image-viewer-control="true"]`,
      ).count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

      const nextStartedAt = Date.now();
      await clickViewerSideNav(page, 'right');
      await expect.poll(() => getViewerImageSrc(page), { timeout: 10_000 }).toContain(PNG_B);
      const nextMs = Date.now() - nextStartedAt;

      const previousStartedAt = Date.now();
      await clickViewerSideNav(page, 'left');
      await expect.poll(() => getViewerImageSrc(page), { timeout: 10_000 }).toContain(PNG_A);
      const previousMs = Date.now() - previousStartedAt;

      await page.keyboard.press('Escape');
      await expect(page.locator(CHAT_IMAGE_VIEWER_SURFACE_SELECTOR)).toHaveCount(0);

      console.info('[chat-image-viewer]', {
        openMs,
        nextMs,
        previousMs,
      });

      expect(openMs).toBeLessThan(5_000);
      expect(nextMs).toBeLessThan(5_000);
      expect(previousMs).toBeLessThan(5_000);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
