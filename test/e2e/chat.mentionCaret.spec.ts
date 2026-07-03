import { expect, test, type Page } from '@playwright/test';
import {
  CHAT_COMPOSER_TEXTAREA_SELECTOR,
  cleanupIsolatedElectron,
  createChatModelFixture,
  createNotesRootFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openNotesRootInNotes,
  setAppViewMode,
} from './notesE2E';

const MENTION_TOKEN_SELECTOR = '[data-mention-preview-token="true"]';

async function waitForFrames(page: Page, frameCount = 2): Promise<void> {
  await page.evaluate(async (count) => {
    for (let index = 0; index < count; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, frameCount);
}

async function getComposerMentionCaretMetrics(page: Page) {
  return page.evaluate((inputSelector) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(inputSelector);
    const token = document.querySelector<HTMLElement>('[data-mention-preview-token="true"]');
    if (!textarea || !token) {
      return null;
    }

    const textareaRect = textarea.getBoundingClientRect();
    const tokenRect = token.getBoundingClientRect();
    const style = window.getComputedStyle(textarea);
    const mirror = document.createElement('div');
    mirror.style.position = 'fixed';
    mirror.style.left = `${textareaRect.left}px`;
    mirror.style.top = `${textareaRect.top}px`;
    mirror.style.width = `${textareaRect.width}px`;
    mirror.style.visibility = 'hidden';
    mirror.style.pointerEvents = 'none';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.overflowWrap = 'break-word';
    mirror.style.boxSizing = style.boxSizing;
    mirror.style.fontFamily = style.fontFamily;
    mirror.style.fontSize = style.fontSize;
    mirror.style.fontStyle = style.fontStyle;
    mirror.style.fontWeight = style.fontWeight;
    mirror.style.letterSpacing = style.letterSpacing;
    mirror.style.lineHeight = style.lineHeight;
    mirror.style.padding = style.padding;
    mirror.style.border = style.border;
    mirror.textContent = textarea.value.slice(0, textarea.selectionStart ?? 0);

    const caretProbe = document.createElement('span');
    caretProbe.textContent = '\u200b';
    mirror.appendChild(caretProbe);
    document.body.appendChild(mirror);
    const caretRect = caretProbe.getBoundingClientRect();
    mirror.remove();

    return {
      activeElementIsTextarea: document.activeElement === textarea,
      value: textarea.value,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
      caretLeft: caretRect.left,
      tokenLeft: tokenRect.left,
      tokenRight: tokenRect.right,
      tokenWidth: tokenRect.width,
    };
  }, CHAT_COMPOSER_TEXTAREA_SELECTOR);
}

async function getComposerSelection(page: Page) {
  return page.evaluate((inputSelector) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(inputSelector);
    if (!textarea) {
      return null;
    }

    return {
      activeElementIsTextarea: document.activeElement === textarea,
      value: textarea.value,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
    };
  }, CHAT_COMPOSER_TEXTAREA_SELECTOR);
}

async function getScrolledMentionClipMetrics(page: Page) {
  return page.evaluate((inputSelector) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(inputSelector);
    const token = document.querySelector<HTMLElement>('[data-mention-preview-token="true"]');
    if (!textarea || !token) {
      return null;
    }

    const textareaRect = textarea.getBoundingClientRect();
    textarea.scrollTop = 72;
    textarea.dispatchEvent(new Event('scroll', { bubbles: true }));
    const tokenRect = token.getBoundingClientRect();
    const hitX = tokenRect.left + Math.min(8, Math.max(1, tokenRect.width / 2));
    const hitY = tokenRect.top + Math.min(8, Math.max(1, tokenRect.height / 2));
    const hit = document.elementFromPoint(hitX, hitY);

    return {
      hitIsToken: Boolean(hit && token.contains(hit)),
      scrollTop: textarea.scrollTop,
      textareaTop: textareaRect.top,
      tokenBottom: tokenRect.bottom,
      tokenTop: tokenRect.top,
    };
  }, CHAT_COMPOSER_TEXTAREA_SELECTOR);
}

test.describe('chat note mention caret', () => {
  test.setTimeout(120_000);

  test('keeps the caret visually outside the mention token after clicking it', async ({}, testInfo) => {
    const { app, userDataRoot } = await launchIsolatedElectron(`chat-mention-caret-${testInfo.workerIndex}`);

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await createChatModelFixture(page, {
        providerName: 'E2E Mention Provider',
        apiModelId: 'e2e-mention-model',
      });

      const notesRoot = await createNotesRootFilesFixture(page, {
        name: 'mention-caret',
        files: [
          { filename: 'Today.md', content: '# Today\n\nCurrent page\n' },
          { filename: 'Tomorrow.md', content: '# Tomorrow\n\nLinked page\n' },
          { filename: 'Projects/Plan.md', content: '# Plan\n\nFolder child\n' },
        ],
      });
      await openNotesRootInNotes(page, {
        notesRootPath: notesRoot.notesRootPath,
        name: 'Mention Caret NotesRoot',
        minFileCount: 2,
      });
      await page.evaluate((notePath) => (window as any).__vlainaE2E.openAbsoluteNote(notePath), notesRoot.notePaths[0]);
      await expect.poll(async () => page.evaluate(() =>
        (window as any).__vlainaE2E.getNotesState().currentNote?.path ?? null
      ), { timeout: 30_000 }).toBe(notesRoot.notePaths[0]);

      await setAppViewMode(page, 'chat');
      const textarea = page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR);
      await expect(textarea).toBeVisible({ timeout: 30_000 });

      await textarea.fill('@To');
      await expect(page.locator('[data-no-focus-input="true"]', { hasText: 'Today' })).toBeVisible({
        timeout: 10_000,
      });
      await textarea.press('Enter');
      await expect(textarea).toHaveValue('@Today ', { timeout: 10_000 });

      const token = page.locator(MENTION_TOKEN_SELECTOR).first();
      await expect(token).toBeVisible({ timeout: 10_000 });
      await token.click();
      await waitForFrames(page, 3);

      const metrics = await getComposerMentionCaretMetrics(page);
      expect(metrics).not.toBeNull();
      expect(metrics).toMatchObject({
        activeElementIsTextarea: true,
        value: '@Today ',
        selectionStart: '@Today '.length,
        selectionEnd: '@Today '.length,
      });
      expect(metrics!.caretLeft).toBeGreaterThanOrEqual(metrics!.tokenRight - 1);

      await page.keyboard.press('Shift+ArrowLeft');
      await waitForFrames(page, 2);

      await expect.poll(() => getComposerSelection(page), { timeout: 10_000 }).toMatchObject({
        activeElementIsTextarea: true,
        value: '@Today ',
        selectionStart: '@Today'.length,
        selectionEnd: '@Today '.length,
      });

      await token.click();
      await waitForFrames(page, 2);

      await page.keyboard.press('Control+A');
      await waitForFrames(page, 2);

      const selection = await getComposerSelection(page);
      expect(selection).toEqual({
        activeElementIsTextarea: true,
        value: '@Today ',
        selectionStart: 0,
        selectionEnd: '@Today '.length,
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('clips mention preview tokens that scroll outside a long composer value', async ({}, testInfo) => {
    const { app, userDataRoot } = await launchIsolatedElectron(`chat-mention-clip-${testInfo.workerIndex}`);

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await createChatModelFixture(page, {
        providerName: 'E2E Mention Clip Provider',
        apiModelId: 'e2e-mention-clip-model',
      });

      const notesRoot = await createNotesRootFilesFixture(page, {
        name: 'mention-clip',
        files: [
          { filename: '3.md', content: '# 3\n\nMention target\n' },
        ],
      });
      await openNotesRootInNotes(page, {
        notesRootPath: notesRoot.notesRootPath,
        name: 'Mention Clip NotesRoot',
        minFileCount: 1,
      });

      await setAppViewMode(page, 'chat');
      const textarea = page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR);
      await expect(textarea).toBeVisible({ timeout: 30_000 });

      const longValue = [
        '@3',
        ...Array.from({ length: 48 }, (_value, index) => `long pasted line ${index + 1}`),
      ].join('\n');
      await textarea.fill(longValue);
      await expect(page.locator(MENTION_TOKEN_SELECTOR)).toBeVisible({ timeout: 10_000 });

      await expect.poll(() => getScrolledMentionClipMetrics(page), { timeout: 10_000 }).toMatchObject({
        hitIsToken: false,
        scrollTop: expect.any(Number),
      });
      const metrics = await getScrolledMentionClipMetrics(page);
      expect(metrics).not.toBeNull();
      expect(metrics!.scrollTop).toBeGreaterThan(0);
      expect(metrics!.tokenBottom).toBeLessThan(metrics!.textareaTop);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
