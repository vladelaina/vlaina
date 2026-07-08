import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  clearSelectedNoteBlocks,
  createChatFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

const CHAT_BLANK_ROOT_SELECTOR = '[data-notes-external-block-selection-root="true"]';
const BLOCK_SELECTION_EXCLUDED_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'summary',
  'label',
  '[role="button"]',
  '[contenteditable="false"]',
  '[data-no-editor-drag-box="true"]',
  '[data-notes-external-block-selection-excluded="true"]',
  '[data-chat-selection-excluded="true"]',
  '[data-chat-input="true"]',
  'img',
  'video',
  'canvas',
].join(', ');

type ChatBlankDragTarget = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  hitTagName: string | null;
  hitAttributes: string[];
};

function createNoteMarkdown() {
  return [
    '# Chat blank block selection',
    '',
    'Chat blank drag target alpha paragraph for external selection.',
    '',
    'Chat blank drag target beta paragraph for external selection.',
    '',
    'Chat blank drag target gamma paragraph for external selection.',
  ].join('\n');
}

async function openSelectionFixture(page: Page) {
  await createChatFixture(page, {
    sessions: [
      {
        title: 'Chat Blank Selection',
        messages: [
          { role: 'user', content: 'Chat blank selection prompt.' },
          { role: 'assistant', content: 'Chat blank selection response.' },
        ],
      },
    ],
  });
  await openMarkdownFixture(page, {
    filename: 'chat-blank-selection.md',
    content: createNoteMarkdown(),
  });
}

async function resolveChatBlankDragTarget(
  page: Page,
  rootSelector: string,
  targetText: string,
): Promise<ChatBlankDragTarget | null> {
  return page.evaluate(async ({
    blankRootSelector,
    excludedSelector,
    rootSelector: selector,
    targetText: text,
  }) => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    const root = document.querySelector<HTMLElement>(selector);
    const block = Array
      .from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror p, .milkdown .ProseMirror h1'))
      .find((element) => element.textContent?.includes(text)) ?? null;
    if (!editor || !root || !block) return null;

    block.scrollIntoView({ block: 'center', inline: 'nearest' });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const editorRect = editor.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const blockRect = block.getBoundingClientRect();
    if (
      editorRect.width <= 0 ||
      editorRect.height <= 0 ||
      rootRect.width <= 0 ||
      rootRect.height <= 0 ||
      blockRect.width <= 0 ||
      blockRect.height <= 0
    ) {
      return null;
    }

    const xSamples = [
      rootRect.left + rootRect.width * 0.5,
      rootRect.left + rootRect.width * 0.25,
      rootRect.left + rootRect.width * 0.75,
      rootRect.left + 24,
      rootRect.right - 24,
    ].filter((value) => value > rootRect.left + 2 && value < rootRect.right - 2);
    const ySamples = [
      rootRect.top + 56,
      rootRect.top + 88,
      rootRect.top + rootRect.height * 0.35,
      rootRect.top + rootRect.height * 0.5,
      rootRect.bottom - 120,
      rootRect.top + 20,
    ].filter((value) => value > rootRect.top + 2 && value < rootRect.bottom - 2);

    for (const y of ySamples) {
      for (const x of xSamples) {
        const hit = document.elementFromPoint(x, y);
        if (!(hit instanceof HTMLElement)) continue;
        if (editor.contains(hit)) continue;
        if (hit.closest(excludedSelector)) continue;
        if (hit.closest(blankRootSelector) !== root) continue;

        const endY = blockRect.top + blockRect.height / 2;
        const preferredEndX = blockRect.left + Math.min(
          Math.max(96, blockRect.width * 0.45),
          Math.max(24, blockRect.width - 24),
        );
        const endX = Math.max(editorRect.left + 24, Math.min(editorRect.right - 24, preferredEndX));
        return {
          startX: x,
          startY: y,
          endX,
          endY,
          hitTagName: hit.tagName,
          hitAttributes: Array.from(hit.attributes).map((attribute) => `${attribute.name}=${attribute.value}`),
        };
      }
    }

    return null;
  }, {
    blankRootSelector: CHAT_BLANK_ROOT_SELECTOR,
    excludedSelector: BLOCK_SELECTION_EXCLUDED_SELECTOR,
    rootSelector,
    targetText,
  });
}

async function dragFromChatBlankIntoBlock(page: Page, rootSelector: string, targetText: string) {
  const dragTarget = await resolveChatBlankDragTarget(page, rootSelector, targetText);
  expect(dragTarget, `Expected blank drag target in ${rootSelector}`).not.toBeNull();

  await page.mouse.move(dragTarget!.startX, dragTarget!.startY);
  await page.mouse.down();
  await page.mouse.move(dragTarget!.endX, dragTarget!.endY, { steps: 12 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate((expectedText) => {
    const selectedTexts = Array
      .from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror .editor-block-selected'))
      .map((element) => element.textContent?.trim() ?? '');
    return selectedTexts.some((text) => text.includes(expectedText));
  }, targetText), {
    message: `Expected block selection from ${rootSelector}`,
    timeout: 10_000,
  }).toBe(true);
}

async function resolveChatMessageSurfaceBlankDragTarget(
  page: Page,
  rootSelector: string,
  targetText: string,
): Promise<ChatBlankDragTarget | null> {
  return page.evaluate(async ({
    blankRootSelector,
    excludedSelector,
    rootSelector: selector,
    targetText: text,
  }) => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    const root = document.querySelector<HTMLElement>(selector);
    const surface = root?.querySelector<HTMLElement>(
      '[data-message-item="true"][data-role="assistant"] [data-chat-selection-surface="true"]'
    ) ?? null;
    const block = Array
      .from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror p, .milkdown .ProseMirror h1'))
      .find((element) => element.textContent?.includes(text)) ?? null;
    if (!editor || !root || !surface || !block) return null;

    block.scrollIntoView({ block: 'center', inline: 'nearest' });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const editorRect = editor.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    const blockRect = block.getBoundingClientRect();
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const firstText = walker.nextNode();
    if (!firstText) return null;

    const range = document.createRange();
    range.selectNodeContents(firstText);
    const textRect = Array.from(range.getClientRects()).find((rect) => rect.width > 0 && rect.height > 0);
    range.detach();
    if (!textRect) return null;

    const y = textRect.top + textRect.height / 2;
    const xCandidates = [
      Math.min(surfaceRect.right - 12, textRect.right + 160),
      Math.min(surfaceRect.right - 12, textRect.right + 96),
      surfaceRect.right - 18,
      surfaceRect.left + surfaceRect.width * 0.75,
    ].filter((value) => value > surfaceRect.left + 4 && value < surfaceRect.right - 4);

    for (const x of xCandidates) {
      const hit = document.elementFromPoint(x, y);
      if (!(hit instanceof HTMLElement)) continue;
      if (editor.contains(hit)) continue;
      if (hit.closest(excludedSelector)) continue;
      if (hit.closest(blankRootSelector) !== root) continue;

      const preferredEndX = blockRect.left + Math.min(
        Math.max(96, blockRect.width * 0.45),
        Math.max(24, blockRect.width - 24),
      );
      return {
        startX: x,
        startY: y,
        endX: Math.max(editorRect.left + 24, Math.min(editorRect.right - 24, preferredEndX)),
        endY: blockRect.top + blockRect.height / 2,
        hitTagName: hit.tagName,
        hitAttributes: Array.from(hit.attributes).map((attribute) => `${attribute.name}=${attribute.value}`),
      };
    }

    return null;
  }, {
    blankRootSelector: CHAT_BLANK_ROOT_SELECTOR,
    excludedSelector: BLOCK_SELECTION_EXCLUDED_SELECTOR,
    rootSelector,
    targetText,
  });
}

async function dragFromChatMessageSurfaceBlankIntoBlock(page: Page, rootSelector: string, targetText: string) {
  const dragTarget = await resolveChatMessageSurfaceBlankDragTarget(page, rootSelector, targetText);
  expect(dragTarget, `Expected message-surface blank drag target in ${rootSelector}`).not.toBeNull();

  await page.mouse.move(dragTarget!.startX, dragTarget!.startY);
  await page.mouse.down();
  await page.mouse.move(dragTarget!.endX, dragTarget!.endY, { steps: 12 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate((expectedText) => {
    const selectedTexts = Array
      .from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror .editor-block-selected'))
      .map((element) => element.textContent?.trim() ?? '');
    return selectedTexts.some((text) => text.includes(expectedText));
  }, targetText), {
    message: `Expected message-surface block selection from ${rootSelector}`,
    timeout: 10_000,
  }).toBe(true);
}

test.describe('notes chat blank block selection', () => {
  test.setTimeout(120_000);

  test('starts block selection from empty docked and floating chat blank surfaces', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-empty-chat-blank-selection');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1440, height: 860 });
      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({
        languagePreference: 'en',
        notesChatPanelCollapsed: false,
      }));
      await openMarkdownFixture(page, {
        filename: 'empty-chat-blank-selection.md',
        content: createNoteMarkdown(),
      });

      await expect(page.locator('[data-notes-chat-panel="true"]')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-notes-chat-panel="true"] [data-chat-view-mode="embedded"]'))
        .toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-notes-chat-panel="true"] [data-message-item="true"]')).toHaveCount(0);
      await dragFromChatBlankIntoBlock(
        page,
        '[data-notes-chat-panel="true"]',
        'Chat blank drag target alpha',
      );

      await clearSelectedNoteBlocks(page);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);

      await page.getByRole('button', { name: 'Close Chat panel' }).click();
      await expect(page.locator('[data-notes-chat-panel="true"]')).toHaveCount(0);
      await page.getByRole('button', { name: 'Right Chat' }).click();
      await expect(page.locator('[data-notes-chat-floating="true"]')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-notes-chat-floating="true"] [data-chat-view-mode="embedded"]'))
        .toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-notes-chat-floating="true"] [data-message-item="true"]')).toHaveCount(0);
      await dragFromChatBlankIntoBlock(
        page,
        '[data-notes-chat-floating="true"]',
        'Chat blank drag target beta',
      );
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('starts block selection from docked and floating chat blank surfaces', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-chat-blank-selection');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1440, height: 860 });
      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({
        languagePreference: 'en',
        notesChatPanelCollapsed: false,
      }));
      await openSelectionFixture(page);

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Chat blank drag target alpha', {
        timeout: 30_000,
      });
      await expect(page.locator('[data-notes-chat-panel="true"]')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-notes-chat-panel="true"] [data-message-item="true"]').first())
        .toBeVisible({ timeout: 30_000 });

      await dragFromChatBlankIntoBlock(
        page,
        '[data-notes-chat-panel="true"]',
        'Chat blank drag target alpha',
      );

      await clearSelectedNoteBlocks(page);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
      await dragFromChatMessageSurfaceBlankIntoBlock(
        page,
        '[data-notes-chat-panel="true"]',
        'Chat blank drag target beta',
      );

      await clearSelectedNoteBlocks(page);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);

      await page.getByRole('button', { name: 'Close Chat panel' }).click();
      await expect(page.locator('[data-notes-chat-panel="true"]')).toHaveCount(0);
      await page.getByRole('button', { name: 'Right Chat' }).click();
      await expect(page.locator('[data-notes-chat-floating="true"]')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-notes-chat-floating="true"] [data-message-item="true"]').first())
        .toBeVisible({ timeout: 30_000 });

      await dragFromChatBlankIntoBlock(
        page,
        '[data-notes-chat-floating="true"]',
        'Chat blank drag target gamma',
      );

      await clearSelectedNoteBlocks(page);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
      await dragFromChatMessageSurfaceBlankIntoBlock(
        page,
        '[data-notes-chat-floating="true"]',
        'Chat blank drag target beta',
      );
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
