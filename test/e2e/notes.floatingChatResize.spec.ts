import { expect, test } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  createChatFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

type FloatingChatResizeMetrics = {
  before: {
    left: number;
    top: number;
    width: number;
    height: number;
    controlTop: number;
  };
  afterMove: {
    left: number;
    top: number;
    width: number;
    height: number;
    controlTop: number;
  };
};

test.describe('notes floating chat resize', () => {
  test('updates the top control row in the same pointer move as the floating panel resize', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-floating-chat-resize-live-controls');

    try {
      await app.firstWindow();
      const [targetPage] = await getOpenBridgePages(app, 1);
      await targetPage.setViewportSize({ width: 1280, height: 860 });
      await targetPage.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({
        languagePreference: 'en',
        notesChatPanelCollapsed: true,
      }));
      await createChatFixture(targetPage, {
        sessions: [
          {
            title: 'Floating Resize Chat',
            messages: [
              { role: 'user', content: 'Keep the floating chat open.' },
              { role: 'assistant', content: 'Floating resize sentinel.' },
            ],
          },
        ],
      });
      await openMarkdownFixture(targetPage, {
        filename: 'floating-chat-resize.md',
        content: '# Floating Chat Resize\n\nResize the floating AI panel.',
      });

      await targetPage.getByRole('button', { name: 'Right Chat' }).click();
      await expect(targetPage.locator('[data-notes-chat-floating="true"]')).toBeVisible({ timeout: 30_000 });
      await expect(targetPage.locator('[data-chat-view-mode="embedded"]')).toBeVisible({ timeout: 30_000 });

      const metrics = await targetPage.evaluate((): FloatingChatResizeMetrics => {
        const panel = document.querySelector<HTMLElement>('[data-notes-chat-floating="true"]');
        const topHandle = document.querySelector<HTMLElement>('[data-notes-chat-floating-resize-handle="top"]');
        const closeButton = document.querySelector<HTMLElement>('[data-notes-chat-floating="true"] [aria-label="Close Chat panel"]');

        if (!panel || !topHandle || !closeButton) {
          throw new Error('Floating chat resize elements were not rendered');
        }

        const readMetrics = () => {
          const panelRect = panel.getBoundingClientRect();
          const controlRect = closeButton.getBoundingClientRect();
          return {
            left: panelRect.left,
            top: panelRect.top,
            width: panelRect.width,
            height: panelRect.height,
            controlTop: controlRect.top,
          };
        };

        const before = readMetrics();
        const startX = before.left + before.width / 2;
        const startY = before.top + 1;
        const dragDeltaY = 72;

        topHandle.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
          clientX: startX,
          clientY: startY,
          pointerId: 1,
          pointerType: 'mouse',
        }));
        window.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
          clientX: startX,
          clientY: startY - dragDeltaY,
          pointerId: 1,
          pointerType: 'mouse',
        }));

        const afterMove = readMetrics();

        window.dispatchEvent(new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 0,
          clientX: startX,
          clientY: startY - dragDeltaY,
          pointerId: 1,
          pointerType: 'mouse',
        }));

        return { before, afterMove };
      });

      expect(metrics.before.height).toBeGreaterThan(400);
      expect(metrics.before.controlTop - metrics.before.top).toBeGreaterThanOrEqual(0);
      expect(metrics.afterMove.height).toBeCloseTo(metrics.before.height + 72, 1);
      expect(metrics.before.top - metrics.afterMove.top).toBeCloseTo(72, 1);
      expect(metrics.afterMove.controlTop - metrics.afterMove.top).toBeCloseTo(
        metrics.before.controlTop - metrics.before.top,
        1,
      );
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
