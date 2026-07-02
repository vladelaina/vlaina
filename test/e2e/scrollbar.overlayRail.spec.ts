import { expect, test, type Page } from '@playwright/test';
import {
  CHAT_SESSION_ROW_SELECTOR,
  cleanupIsolatedElectron,
  createChatFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  setAppViewMode,
} from './notesE2E';

const MODEL_DROPDOWN_SELECTOR = '[data-model-selector-dropdown="true"]';
const SETTINGS_MODAL_SELECTOR = '[data-settings-modal="true"]';

type OrdinaryWheelTarget = 'settings-content' | 'model-selector-list';

async function waitForAnimationFrame(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function seedScrollableChat(page: Page) {
  await createChatFixture(page, {
    sessions: Array.from({ length: 72 }, (_, index) => ({
      title: `E2E Rail Scroll Chat ${index.toString().padStart(2, '0')}`,
      messages: [
        {
          role: 'user' as const,
          content: `Sidebar rail scroll fixture ${index}`,
        },
      ],
    })),
    activeSessionIndex: 0,
  });
}

async function seedScrollableModelSelector(page: Page) {
  return page.evaluate(async () => {
    const bridge = (window as any).__vlainaE2E;
    const providerId = await bridge.addProvider({
      name: 'E2E Rail Scroll Models',
      apiHost: 'https://e2e-rail-scroll.invalid/v1',
      apiKey: 'sk-e2e-rail-scroll',
      enabled: true,
      endpointTypeCheckedAt: Date.now(),
    });

    for (let index = 0; index < 48; index += 1) {
      const modelName = `E2E Rail Scroll Model ${index.toString().padStart(2, '0')}`;
      await bridge.addModel({
        providerId,
        apiModelId: `e2e-rail-scroll-model-${index.toString().padStart(2, '0')}`,
        name: modelName,
        enabled: true,
        selected: index === 0,
      });
    }

    return providerId as string;
  });
}

async function openSettingsTab(page: Page, tab: 'about') {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('open-settings'));
  });
  await expect(page.locator(SETTINGS_MODAL_SELECTOR)).toBeVisible({ timeout: 30_000 });
  await page.locator(`[data-settings-tab="${tab}"]`).click();
  await expect(page.locator(SETTINGS_MODAL_SELECTOR)).toHaveAttribute('data-settings-active-tab', tab, {
    timeout: 10_000,
  });
}

async function dispatchOrdinaryWheelTarget(page: Page, targetKind: OrdinaryWheelTarget) {
  return page.evaluate((kind) => {
    const resolveTarget = () => {
      if (kind === 'settings-content') {
        return document.querySelector<HTMLElement>('[data-settings-scroll-root="content"]');
      }

      const dropdown = document.querySelector<HTMLElement>('[data-model-selector-dropdown="true"]');
      const scrollableViewports = Array.from(dropdown?.querySelectorAll<HTMLElement>('.scrollbar-hidden') ?? [])
        .filter((element) => element.scrollHeight > element.clientHeight + 1);
      return scrollableViewports[scrollableViewports.length - 1] ?? null;
    };

    const target = resolveTarget();
    if (!target || target.scrollHeight <= target.clientHeight + 1) {
      return null;
    }

    target.scrollTop = 0;
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 3,
      deltaMode: WheelEvent.DOM_DELTA_LINE,
    });
    target.dispatchEvent(event);

    return {
      defaultPrevented: event.defaultPrevented,
      scrollTop: target.scrollTop,
    };
  }, targetKind);
}

async function wheelTrustedOrdinaryScrollTarget(page: Page, targetKind: OrdinaryWheelTarget) {
  const point = await page.evaluate((kind) => {
    const resolveTarget = () => {
      if (kind === 'settings-content') {
        return document.querySelector<HTMLElement>('[data-settings-scroll-root="content"]');
      }

      const dropdown = document.querySelector<HTMLElement>('[data-model-selector-dropdown="true"]');
      const scrollableViewports = Array.from(dropdown?.querySelectorAll<HTMLElement>('.scrollbar-hidden') ?? [])
        .filter((element) => element.scrollHeight > element.clientHeight + 1);
      return scrollableViewports[scrollableViewports.length - 1] ?? null;
    };

    const target = resolveTarget();
    if (!target || target.scrollHeight <= target.clientHeight + 1) {
      return null;
    }

    target.scrollTop = 0;
    const rect = target.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, targetKind);

  expect(point).not.toBeNull();
  await page.mouse.move(point!.x, point!.y);
  await page.mouse.wheel(0, 240);
}

async function wheelChatSidebarRail(page: Page) {
  return page.evaluate(async () => {
    const viewport = Array.from(document.querySelectorAll<HTMLElement>('[data-sidebar-scroll-root="true"]'))
      .find((candidate) =>
        candidate.scrollHeight > candidate.clientHeight + 1 &&
        candidate.querySelector('[data-chat-sidebar-session-row="true"]')
      );
    const rail = viewport?.parentElement?.querySelector<HTMLElement>('[data-overlay-scrollbar-rail="true"]');
    if (!viewport || !rail) {
      return null;
    }

    viewport.scrollTop = 0;
    const before = viewport.scrollTop;
    rail.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 3,
      deltaMode: WheelEvent.DOM_DELTA_LINE,
    }));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    return {
      before,
      after: viewport.scrollTop,
      maxScrollTop: viewport.scrollHeight - viewport.clientHeight,
    };
  });
}

async function wheelModelSelectorRail(page: Page) {
  return page.evaluate(async (dropdownSelector) => {
    const dropdown = document.querySelector<HTMLElement>(dropdownSelector);
    const candidates = Array.from(dropdown?.querySelectorAll<HTMLElement>('[data-overlay-scrollbar-rail="true"]') ?? [])
      .map((rail) => {
        const viewport = rail.parentElement?.firstElementChild;
        return viewport instanceof HTMLElement ? { rail, viewport } : null;
      })
      .filter((candidate): candidate is { rail: HTMLElement; viewport: HTMLElement } =>
        Boolean(candidate && candidate.viewport.scrollHeight > candidate.viewport.clientHeight + 1)
      );
    const target = candidates[candidates.length - 1];
    if (!target) {
      return null;
    }

    target.viewport.scrollTop = 0;
    const before = target.viewport.scrollTop;
    target.rail.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 3,
      deltaMode: WheelEvent.DOM_DELTA_LINE,
    }));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    return {
      before,
      after: target.viewport.scrollTop,
      maxScrollTop: target.viewport.scrollHeight - target.viewport.clientHeight,
    };
  }, MODEL_DROPDOWN_SELECTOR);
}

test.describe('overlay scrollbar rail scrolling', () => {
  test.setTimeout(90_000);

  test('keeps ordinary wheel scrolling on the native browser path', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('ordinary-wheel-scroll');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await openSettingsTab(page, 'about');
      const settingsWheel = await dispatchOrdinaryWheelTarget(page, 'settings-content');
      if (!settingsWheel) {
        throw new Error('Settings content scroll target was not available');
      }
      expect(settingsWheel.defaultPrevented, JSON.stringify(settingsWheel, null, 2)).toBe(false);
      expect(settingsWheel.scrollTop, JSON.stringify(settingsWheel, null, 2)).toBe(0);
      await wheelTrustedOrdinaryScrollTarget(page, 'settings-content');
      await expect.poll(() => page.locator('[data-settings-scroll-root="content"]').evaluate((element) =>
        Math.round((element as HTMLElement).scrollTop)
      ), { timeout: 10_000 }).toBeGreaterThan(0);

      await page.locator('[data-settings-action="close"]').click();

      await seedScrollableModelSelector(page);
      await setAppViewMode(page, 'chat');
      await page.getByRole('button', { name: /E2E Rail Scroll Model 00/ }).click();
      await expect(page.locator(MODEL_DROPDOWN_SELECTOR)).toBeVisible({ timeout: 10_000 });
      await waitForAnimationFrame(page);

      const modelSelectorWheel = await dispatchOrdinaryWheelTarget(page, 'model-selector-list');
      if (!modelSelectorWheel) {
        throw new Error('Model selector scroll target was not available');
      }
      expect(modelSelectorWheel.defaultPrevented, JSON.stringify(modelSelectorWheel, null, 2)).toBe(false);
      expect(modelSelectorWheel.scrollTop, JSON.stringify(modelSelectorWheel, null, 2)).toBe(0);
      await wheelTrustedOrdinaryScrollTarget(page, 'model-selector-list');
      await expect.poll(() => page.evaluate((dropdownSelector) => {
        const dropdown = document.querySelector<HTMLElement>(dropdownSelector);
        const scrollableViewports = Array.from(dropdown?.querySelectorAll<HTMLElement>('.scrollbar-hidden') ?? [])
          .filter((element) => element.scrollHeight > element.clientHeight + 1);
        return Math.round(scrollableViewports[scrollableViewports.length - 1]?.scrollTop ?? 0);
      }, MODEL_DROPDOWN_SELECTOR), { timeout: 10_000 }).toBeGreaterThan(0);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('scrolls chat sidebar and model selector when wheel starts on the overlay rail', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('overlay-scrollbar-rail');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await seedScrollableModelSelector(page);
      await seedScrollableChat(page);
      await setAppViewMode(page, 'chat');
      await expect(page.locator(CHAT_SESSION_ROW_SELECTOR).first()).toBeVisible({ timeout: 10_000 });
      await waitForAnimationFrame(page);

      await expect.poll(() => wheelChatSidebarRail(page), { timeout: 10_000 }).toMatchObject({
        before: 0,
        after: expect.any(Number),
        maxScrollTop: expect.any(Number),
      });
      const sidebarResult = await wheelChatSidebarRail(page);
      expect(sidebarResult).not.toBeNull();
      expect(sidebarResult!.maxScrollTop).toBeGreaterThan(0);
      expect(sidebarResult!.after).toBeGreaterThan(sidebarResult!.before);

      await page.getByRole('button', { name: /E2E Rail Scroll Model 00/ }).click();
      await expect(page.locator(MODEL_DROPDOWN_SELECTOR)).toBeVisible({ timeout: 10_000 });
      await waitForAnimationFrame(page);

      await expect.poll(() => wheelModelSelectorRail(page), { timeout: 10_000 }).toMatchObject({
        before: 0,
        after: expect.any(Number),
        maxScrollTop: expect.any(Number),
      });
      const modelSelectorResult = await wheelModelSelectorRail(page);
      expect(modelSelectorResult).not.toBeNull();
      expect(modelSelectorResult!.maxScrollTop).toBeGreaterThan(0);
      expect(modelSelectorResult!.after).toBeGreaterThan(modelSelectorResult!.before);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
