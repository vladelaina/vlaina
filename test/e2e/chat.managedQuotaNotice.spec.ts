import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import {
  CHAT_COMPOSER_TEXTAREA_SELECTOR,
  CHAT_VIEW_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  setAppViewMode,
} from './notesE2E';

const MANAGED_QUOTA_BANNER_SELECTOR = '[data-managed-quota-banner="true"]';

async function readComposerCaretGeometry(page: Page) {
  return page.evaluate((textareaSelector) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(textareaSelector);
    const caret = document.querySelector<HTMLElement>('.native-caret-overlay');
    const banner = document.querySelector<HTMLElement>('[data-managed-quota-banner="true"]');
    const composer = document.querySelector<HTMLElement>('[data-chat-input="true"]');
    if (!textarea || !caret || !banner || !composer) {
      return null;
    }

    const textareaRect = textarea.getBoundingClientRect();
    const caretRect = caret.getBoundingClientRect();
    const bannerRect = banner.getBoundingClientRect();
    const composerRect = composer.getBoundingClientRect();
    const styles = getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight);
    const paddingTop = Number.parseFloat(styles.paddingTop);
    const paddingBottom = Number.parseFloat(styles.paddingBottom);
    const caretCenterY = caretRect.top + caretRect.height / 2;
    const contentTop = textareaRect.top + (Number.isFinite(paddingTop) ? paddingTop : 0);
    const contentBottom = textareaRect.bottom - (Number.isFinite(paddingBottom) ? paddingBottom : 0);

    return {
      bannerTop: bannerRect.top,
      caretBottom: caretRect.bottom,
      caretCenterY,
      caretHeight: caretRect.height,
      caretLeft: caretRect.left,
      caretTop: caretRect.top,
      composerBottom: composerRect.bottom,
      contentBottom,
      contentTop,
      lineHeight,
      selectionStart: textarea.selectionStart,
      textareaBottom: textareaRect.bottom,
      textareaClientHeight: textarea.clientHeight,
      textareaHeight: textareaRect.height,
      textareaLeft: textareaRect.left,
      textareaRight: textareaRect.right,
      textareaScrollHeight: textarea.scrollHeight,
      textareaScrollTop: textarea.scrollTop,
      textareaTop: textareaRect.top,
      value: textarea.value,
    };
  }, CHAT_COMPOSER_TEXTAREA_SELECTOR);
}

async function expectComposerCaretInsideQuotaInput(
  page: Page,
  selectionIndex: number,
  options: { expectScrolled?: boolean; scrollToBottom?: boolean } = {},
) {
  const textarea = page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR);
  await textarea.evaluate((element, { index, scrollToBottom }) => {
    element.focus();
    element.setSelectionRange(index, index);
    if (scrollToBottom) {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    }
    document.dispatchEvent(new Event('vlaina:native-caret-overlay-refresh'));
  }, { index: selectionIndex, scrollToBottom: options.scrollToBottom ?? false });

  await expect.poll(
    () => readComposerCaretGeometry(page),
    { timeout: 5_000 },
  ).not.toBeNull();
  const resolvedGeometry = await readComposerCaretGeometry(page);
  expect(resolvedGeometry).not.toBeNull();
  if (!resolvedGeometry) return;

  expect(resolvedGeometry.caretHeight).toBeGreaterThan(0);
  expect(resolvedGeometry.caretLeft).toBeGreaterThanOrEqual(resolvedGeometry.textareaLeft - 1);
  expect(resolvedGeometry.caretLeft).toBeLessThanOrEqual(resolvedGeometry.textareaRight + 1);
  expect(resolvedGeometry.caretCenterY).toBeGreaterThanOrEqual(resolvedGeometry.contentTop - 1);
  expect(resolvedGeometry.caretCenterY).toBeLessThanOrEqual(resolvedGeometry.contentBottom + 1);
  expect(resolvedGeometry.caretBottom).toBeLessThanOrEqual(resolvedGeometry.bannerTop - 1);
  expect(resolvedGeometry.textareaBottom).toBeLessThanOrEqual(resolvedGeometry.composerBottom + 1);
  expect(resolvedGeometry.textareaHeight).toBeGreaterThanOrEqual(Math.min(resolvedGeometry.lineHeight, 20));
  if (options.expectScrolled) {
    expect(resolvedGeometry.textareaScrollHeight).toBeGreaterThan(resolvedGeometry.textareaClientHeight);
    expect(resolvedGeometry.textareaScrollTop).toBeGreaterThan(0);
  }
}

async function interceptExternalUrls(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ shell }) => {
    const globalState = globalThis as typeof globalThis & {
      __vlainaE2EOpenedExternalUrls?: string[];
    };
    globalState.__vlainaE2EOpenedExternalUrls = [];
    shell.openExternal = async (url: string) => {
      globalState.__vlainaE2EOpenedExternalUrls?.push(url);
      return true;
    };
  });
}

async function getOpenedExternalUrls(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(() => {
    const globalState = globalThis as typeof globalThis & {
      __vlainaE2EOpenedExternalUrls?: string[];
    };
    return globalState.__vlainaE2EOpenedExternalUrls ?? [];
  });
}

test.describe('managed quota notice', () => {
  test('keeps the exhausted quota notice after clicking upgrade and refocusing the app', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('chat-managed-quota-notice');

    try {
      await interceptExternalUrls(app);
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await page.evaluate(() => (window as any).__vlainaE2E.addModel({
        providerId: 'vlaina-managed',
        apiModelId: 'e2e-managed-model',
        name: 'E2E Managed Model',
        enabled: true,
        selected: true,
      }));
      await page.evaluate(() => (window as any).__vlainaE2E.applyManagedBudgetSnapshot({
        active: false,
        usedPercent: 100,
        remainingPercent: 0,
        status: 'exhausted',
      }));
      await setAppViewMode(page, 'chat');

      await expect(page.locator(CHAT_VIEW_SELECTOR)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(MANAGED_QUOTA_BANNER_SELECTOR)).toBeVisible({ timeout: 10_000 });

      const textarea = page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR);
      await textarea.fill('A short quota-blocked prompt that should keep the caret inside the composer.');
      await expectComposerCaretInsideQuotaInput(page, 8);
      await expectComposerCaretInsideQuotaInput(page, 72);

      const wrappedPrompt = Array.from({ length: 8 }, (_, index) =>
        `Quota wrapped segment ${index + 1} keeps the caret aligned with the input text while the notice is visible.`
      ).join(' ');
      await textarea.fill(wrappedPrompt);
      await expectComposerCaretInsideQuotaInput(page, Math.floor(wrappedPrompt.length / 2));
      await expectComposerCaretInsideQuotaInput(page, wrappedPrompt.length);

      const scrollingPrompt = Array.from({ length: 26 }, (_, index) =>
        `Quota blocked line ${index + 1} keeps the caret inside the visible textarea content.`
      ).join('\n');
      await textarea.fill(scrollingPrompt);
      await expectComposerCaretInsideQuotaInput(page, scrollingPrompt.length, {
        expectScrolled: true,
        scrollToBottom: true,
      });

      await page.locator(MANAGED_QUOTA_BANNER_SELECTOR).getByRole('button').click();
      await expect.poll(async () => getOpenedExternalUrls(app), { timeout: 10_000 }).toContain(
        'https://vlaina.com/r/spark_continue',
      );

      await page.waitForTimeout(1600);
      await page.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
      });

      await expect(page.locator(MANAGED_QUOTA_BANNER_SELECTOR)).toBeVisible({ timeout: 10_000 });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
