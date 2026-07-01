import { expect, test } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  createChatFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

type ResizeHandleRect = {
  left: number;
  right: number;
  width: number;
};

type DockedChatResizeMetrics = {
  sidebarHandle: ResizeHandleRect;
  chatHandle: ResizeHandleRect;
  gap: number;
  notesView: ResizeHandleRect;
  panel: ResizeHandleRect;
  viewportWidth: number;
};

test.describe('notes docked chat resize', () => {
  test('keeps the docked chat resize handle separated from the left sidebar handle', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-docked-chat-resize-safe-gap');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1024, height: 760 });
      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({
        languagePreference: 'en',
        sidebarWidth: 400,
        notesChatPanelCollapsed: true,
      }));
      await createChatFixture(page, {
        sessions: [
          {
            title: 'Docked Resize Chat',
            messages: [
              { role: 'user', content: 'Keep the docked chat open.' },
              { role: 'assistant', content: 'Docked resize sentinel.' },
            ],
          },
        ],
      });
      await openMarkdownFixture(page, {
        filename: 'docked-chat-resize.md',
        content: '# Docked Chat Resize\n\nResize the docked AI panel.',
      });
      await page.evaluate(() => {
        window.localStorage.setItem('vlaina_notes_chat_panel_width_v2', '760');
      });
      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({
        sidebarWidth: 400,
        notesChatPanelCollapsed: false,
      }));
      await expect(page.locator('[data-notes-chat-panel="true"]')).toBeVisible({ timeout: 30_000 });

      const metrics = await page.evaluate((): DockedChatResizeMetrics => {
        const panel = document.querySelector<HTMLElement>('[data-notes-chat-panel="true"]')?.parentElement;
        const notesView = document.querySelector<HTMLElement>('[data-notes-view-mode="true"]');
        const handles = Array
          .from(document.querySelectorAll<HTMLElement>('.cursor-col-resize'))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { element, rect };
          })
          .filter(({ rect }) => rect.width > 0 && rect.height > 0)
          .sort((left, right) => left.rect.left - right.rect.left);

        if (!panel || !notesView || handles.length < 2) {
          throw new Error('Docked chat resize elements were not rendered');
        }

        const readRect = (element: Element): ResizeHandleRect => {
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            width: rect.width,
          };
        };

        const sidebarHandle = handles[0]!.element;
        const chatHandle = handles[handles.length - 1]!.element;
        const start = chatHandle.getBoundingClientRect();
        const targetX = 300;

        chatHandle.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
          clientX: start.left + start.width / 2,
          clientY: start.top + start.height / 2,
        }));
        document.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
          clientX: targetX,
          clientY: start.top + start.height / 2,
        }));
        document.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 0,
          clientX: targetX,
          clientY: start.top + start.height / 2,
        }));

        const sidebarRect = readRect(sidebarHandle);
        const chatRect = readRect(chatHandle);

        return {
          sidebarHandle: sidebarRect,
          chatHandle: chatRect,
          gap: chatRect.left - sidebarRect.right,
          notesView: readRect(notesView),
          panel: readRect(panel),
          viewportWidth: window.innerWidth,
        };
      });

      expect(metrics.viewportWidth).toBe(1024);
      expect(metrics.notesView.left).toBeGreaterThanOrEqual(399);
      expect(metrics.chatHandle.left).toBeGreaterThan(metrics.sidebarHandle.right);
      expect(metrics.gap).toBeGreaterThanOrEqual(22);
      expect(metrics.panel.left).toBeGreaterThanOrEqual(metrics.notesView.left + 32);

      const beforeSecondDrag = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('[data-notes-chat-panel="true"]')?.parentElement;
        const handles = Array
          .from(document.querySelectorAll<HTMLElement>('.cursor-col-resize'))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
          })
          .filter((rect) => rect.width > 0)
          .sort((left, right) => left.left - right.left);
        const chatHandle = handles[handles.length - 1];
        if (!panel || !chatHandle) {
          throw new Error('Docked chat handle was not available for the second drag');
        }
        const panelRect = panel.getBoundingClientRect();
        return {
          sidebarWidth: (window as any).__vlainaE2E.getUIState().sidebarWidth,
          panelWidth: panelRect.width,
          chatHandle,
        };
      });

      await page.mouse.move(
        (beforeSecondDrag.chatHandle.left + beforeSecondDrag.chatHandle.right) / 2,
        (beforeSecondDrag.chatHandle.top + beforeSecondDrag.chatHandle.bottom) / 2,
      );
      await page.mouse.down();
      await page.mouse.move(beforeSecondDrag.chatHandle.right + 80, beforeSecondDrag.chatHandle.top + 20);
      await page.mouse.up();

      const afterSecondDrag = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('[data-notes-chat-panel="true"]')?.parentElement;
        if (!panel) {
          throw new Error('Docked chat panel was not available after the second drag');
        }
        const panelRect = panel.getBoundingClientRect();
        return {
          sidebarWidth: (window as any).__vlainaE2E.getUIState().sidebarWidth,
          panelWidth: panelRect.width,
        };
      });

      expect(afterSecondDrag.sidebarWidth).toBe(beforeSecondDrag.sidebarWidth);
      expect(afterSecondDrag.panelWidth).toBeLessThan(beforeSecondDrag.panelWidth);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
