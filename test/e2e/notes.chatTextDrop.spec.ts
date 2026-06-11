import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  collectEditorDomMetrics,
  collectEditorVisibilityProblems,
  createChatFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

const CHAT_HEADING_DRAG_MIME = 'application/x-vlaina-chat-heading+json';

type DropBlockSummary = {
  tagName: string;
  text: string;
  height: number;
  isMarkdownBlankLine: boolean;
};

async function dispatchTextDropIntoEditor(page: Page, text: string) {
  const result = await page.evaluate(({ editorSelector, payload }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) {
      return { dropped: false, defaultPrevented: false, reason: 'missing-editor' };
    }

    editor.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = editor.getBoundingClientRect();
    const clientX = Math.max(rect.left + 24, Math.min(rect.right - 24, rect.left + rect.width * 0.42));
    const clientY = Math.max(rect.top + 24, Math.min(rect.bottom - 24, rect.bottom - 42));
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', payload);
    dataTransfer.effectAllowed = 'copy';

    for (const type of ['dragenter', 'dragover'] as const) {
      editor.dispatchEvent(new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        dataTransfer,
      }));
    }

    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      dataTransfer,
    });
    const dispatched = editor.dispatchEvent(dropEvent);

    return {
      dropped: dispatched,
      defaultPrevented: dropEvent.defaultPrevented,
      reason: null,
    };
  }, { editorSelector: EDITOR_SELECTOR, payload: text });

  expect(result.reason).toBeNull();
  expect(result.defaultPrevented).toBe(true);
  await waitForEditorAnimationFrame(page);
}

async function dispatchChatHeadingDropIntoEditor(page: Page, heading: { level: number; text: string }) {
  const result = await page.evaluate(({ editorSelector, payload, mime }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) {
      return { dropped: false, defaultPrevented: false, reason: 'missing-editor' };
    }

    editor.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = editor.getBoundingClientRect();
    const clientX = Math.max(rect.left + 24, Math.min(rect.right - 24, rect.left + rect.width * 0.42));
    const clientY = Math.max(rect.top + 24, Math.min(rect.bottom - 24, rect.bottom - 42));
    const dataTransfer = new DataTransfer();
    dataTransfer.setData(mime, JSON.stringify(payload));
    dataTransfer.setData('text/plain', `${'#'.repeat(payload.level)} ${payload.text}`);
    dataTransfer.effectAllowed = 'copy';

    for (const type of ['dragenter', 'dragover'] as const) {
      editor.dispatchEvent(new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        dataTransfer,
      }));
    }

    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      dataTransfer,
    });
    const dispatched = editor.dispatchEvent(dropEvent);

    return {
      dropped: dispatched,
      defaultPrevented: dropEvent.defaultPrevented,
      reason: null,
    };
  }, { editorSelector: EDITOR_SELECTOR, payload: heading, mime: CHAT_HEADING_DRAG_MIME });

  expect(result.reason).toBeNull();
  expect(result.defaultPrevented).toBe(true);
  await waitForEditorAnimationFrame(page);
}

async function collectBlocksBetween(page: Page, firstText: string, secondText: string) {
  return page.evaluate(({ editorSelector, first, second }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const blocks = Array.from(editor?.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,[data-type="html-block"]') ?? [])
      .filter((element) => element.dataset.type !== 'html-block'
        || element.dataset.value === '<!--vlaina-markdown-blank-line-->')
      .map((element): DropBlockSummary => ({
        tagName: element.tagName,
        text: element.textContent?.trim() ?? '',
        height: Math.round(element.getBoundingClientRect().height),
        isMarkdownBlankLine: element.dataset.type === 'html-block'
          && element.dataset.value === '<!--vlaina-markdown-blank-line-->',
      }));
    const firstIndex = blocks.findIndex((block) => block.text.includes(first));
    const secondIndex = blocks.findIndex((block) => block.text.includes(second));
    const between = firstIndex >= 0 && secondIndex > firstIndex
      ? blocks.slice(firstIndex + 1, secondIndex)
      : [];
    return {
      blocks,
      firstIndex,
      secondIndex,
      emptyVisibleBetween: between.filter((block) => (
        block.isMarkdownBlankLine || block.text.length === 0
      ) && block.height > 0).length,
    };
  }, { editorSelector: EDITOR_SELECTOR, first: firstText, second: secondText });
}

async function expectVisibleBlankLineBetween(page: Page, firstText: string, secondText: string) {
  await expect.poll(() => collectBlocksBetween(page, firstText, secondText), { timeout: 10_000 })
    .toMatchObject({
      firstIndex: expect.any(Number),
      secondIndex: expect.any(Number),
      emptyVisibleBetween: expect.any(Number),
    });
  await expect.poll(async () => {
    const summary = await collectBlocksBetween(page, firstText, secondText);
    return summary.firstIndex >= 0
      && summary.secondIndex > summary.firstIndex
      && summary.emptyVisibleBetween >= 1;
  }, { timeout: 10_000 }).toBe(true);
}

test.describe('notes chat text drop coverage', () => {
  test.setTimeout(120_000);

  test('preserves visible blank lines when dropping text from floating and docked chat into notes', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-chat-text-drop');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await createChatFixture(page, {
        activeSessionIndex: 0,
        sessions: [
          {
            title: 'E2E Notes Drop Chat',
            messages: [
              {
                role: 'assistant',
                content: [
                  'Floating Drop Alpha',
                  '',
                  'Floating Drop Beta',
                  '',
                  'Docked Drop Alpha',
                  '',
                  '',
                  'Docked Drop Beta',
                ].join('\n'),
              },
            ],
          },
        ],
      });

      const opened = await openMarkdownFixture(page, {
        filename: 'chat-text-drop.md',
        content: 'Drop anchor sentinel',
      });

      await page.keyboard.press('Control+L');
      await expect(page.locator('[data-notes-chat-floating="true"]')).toBeVisible({ timeout: 10_000 });
      await dispatchTextDropIntoEditor(page, 'Floating Drop Alpha\n\nFloating Drop Beta');
      await expectVisibleBlankLineBetween(page, 'Floating Drop Alpha', 'Floating Drop Beta');

      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({
        notesChatPanelCollapsed: false,
      }));
      await expect(page.locator('[data-notes-chat-panel="true"]')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('[data-notes-chat-floating="true"]')).toHaveCount(0);
      await dispatchTextDropIntoEditor(page, 'Docked Drop Alpha\n\n\nDocked Drop Beta');
      await expectVisibleBlankLineBetween(page, 'Docked Drop Alpha', 'Docked Drop Beta');

      await expect.poll(() => collectEditorVisibilityProblems(page), { timeout: 10_000 }).toEqual([]);
      const metrics = await collectEditorDomMetrics(page);
      expect(metrics.countsBySelector.sourceFallback).toBe(0);
      expect(metrics.countsBySelector.paragraphs).toBeGreaterThanOrEqual(5);
      expect(metrics.countsBySelector.markdownBlankLines).toBeGreaterThanOrEqual(3);

      await page.evaluate(() => (window as any).__vlainaE2E.flushCurrentEditorMarkdown());
      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      const saved = await page.evaluate((path) => (window as any).__vlainaE2E.readTextFile(path), opened.notePath);
      expect(saved).toContain('Floating Drop Alpha\n\nFloating Drop Beta');
      expect(saved).toContain('Docked Drop Alpha\n\n\nDocked Drop Beta');

      await page.evaluate((path) => (window as any).__vlainaE2E.openAbsoluteNote(path), opened.notePath);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Floating Drop Alpha', { timeout: 10_000 });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Docked Drop Alpha', { timeout: 10_000 });
      await expectVisibleBlankLineBetween(page, 'Floating Drop Alpha', 'Floating Drop Beta');
      await expectVisibleBlankLineBetween(page, 'Docked Drop Alpha', 'Docked Drop Beta');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps dedicated chat heading drops on the heading drop path', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-chat-heading-drop');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const opened = await openMarkdownFixture(page, {
        filename: 'chat-heading-drop.md',
        content: 'Heading drop anchor sentinel',
      });

      await dispatchChatHeadingDropIntoEditor(page, {
        level: 2,
        text: 'Dedicated Chat Heading Drop',
      });

      await expect(page.locator(`${EDITOR_SELECTOR} h2`, { hasText: 'Dedicated Chat Heading Drop' }))
        .toBeVisible({ timeout: 10_000 });

      await page.evaluate(() => (window as any).__vlainaE2E.flushCurrentEditorMarkdown());
      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      const saved = await page.evaluate((path) => (window as any).__vlainaE2E.readTextFile(path), opened.notePath);
      expect(saved).toContain('## Dedicated Chat Heading Drop');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
