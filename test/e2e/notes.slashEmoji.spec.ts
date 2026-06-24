import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

function getEmojiTextRangeRect(editor: Element, emoji: string) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? '';
    const index = text.indexOf(emoji);
    if (index >= 0) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + emoji.length);
      const rect = range.getBoundingClientRect();
      range.detach();
      return { top: rect.top, height: rect.height };
    }
    node = walker.nextNode();
  }
  return null;
}

async function openSlashEmojiPickerFromEditorEnd(page: any) {
  const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
  expect(focused).toBe(true);

  await page.keyboard.type('/e');
  await expect(page.locator('.slash-menu-item.selected')).toContainText('Emoji');
  await page.keyboard.press('Enter');
  await expect(page.locator('.slash-emoji-picker')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByPlaceholder(/Search emojis/i)).toBeVisible();
  await expect(page.locator('.slash-menu')).toHaveCount(0);
}

test.describe('notes slash emoji command', () => {
  test('opens from slash typed after and inside existing paragraph text', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-slash-emoji-inline-text');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'slash-emoji-inline-text-e2e.md',
        content: [
          '# Slash Emoji Inline Text',
          '',
          'Slash should work in ordinary text.',
        ].join('\n'),
      });

      let focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
      expect(focused).toBe(true);
      await page.keyboard.type('aftertext');
      await page.keyboard.type('/e');
      await expect(page.locator('.slash-menu-item.selected')).toContainText('Emoji');
      await page.keyboard.press('Enter');
      await expect(page.locator('.slash-emoji-picker')).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press('Escape');
      await expect(page.locator('.slash-emoji-picker')).toHaveCount(0, { timeout: 10_000 });

      focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
      expect(focused).toBe(true);
      await page.keyboard.type('prefixsuffix');
      for (let index = 0; index < 'suffix'.length; index += 1) {
        await page.keyboard.press('ArrowLeft');
      }
      await page.keyboard.type('/e');
      await expect(page.locator('.slash-menu-item.selected')).toContainText('Emoji');
      await page.keyboard.press('Enter');
      await expect(page.locator('.slash-emoji-picker')).toBeVisible({ timeout: 10_000 });

      await page.getByPlaceholder(/Search emojis/i).fill('rocket');
      const rocket = page.locator('.slash-emoji-picker [data-icon="🚀"]').first();
      await expect(rocket).toBeVisible({ timeout: 10_000 });
      await rocket.click();
      await expect(page.locator('.slash-emoji-picker')).toHaveCount(0, { timeout: 10_000 });

      const editorText = await page.locator(EDITOR_SELECTOR).evaluate((editor) => editor.textContent ?? '');
      expect(editorText).toContain('prefix🚀suffix');
      expect(editorText).not.toContain('prefix/esuffix');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('handles escape, outside click, hover leave, and empty search states', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-slash-emoji-interactions');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'slash-emoji-interactions-e2e.md',
        content: [
          '# Slash Emoji Interactions',
          '',
          'Exercise picker close and search states.',
        ].join('\n'),
      });

      await openSlashEmojiPickerFromEditorEnd(page);
      await page.keyboard.press('Escape');
      await expect(page.locator('.slash-emoji-picker')).toHaveCount(0, { timeout: 10_000 });
      await expect(page.locator('[data-slash-emoji-preview="true"]')).toHaveCount(0);
      await expect(page.locator(EDITOR_SELECTOR)).toBeFocused();

      await openSlashEmojiPickerFromEditorEnd(page);
      await page.getByPlaceholder(/Search emojis/i).fill('rocket');
      const rocket = page.locator('.slash-emoji-picker [data-icon="🚀"]').first();
      await expect(rocket).toBeVisible({ timeout: 10_000 });
      await rocket.hover();
      await expect(page.locator(`${EDITOR_SELECTOR} [data-slash-emoji-preview="true"]`)).toHaveText('🚀');
      await page.getByPlaceholder(/Search emojis/i).hover();
      await expect(page.locator('[data-slash-emoji-preview="true"]')).toHaveCount(0);

      await page.getByPlaceholder(/Search emojis/i).fill('unlikely-no-match-zzzzzz');
      await expect(page.locator('.slash-emoji-picker [data-icon="🚀"]')).toHaveCount(0);
      await page.getByPlaceholder(/Search emojis/i).fill('rocket');
      await expect(rocket).toBeVisible({ timeout: 10_000 });

      await rocket.hover();
      await expect(page.locator(`${EDITOR_SELECTOR} [data-slash-emoji-preview="true"]`)).toHaveText('🚀');
      await page.mouse.click(20, 20);
      await expect(page.locator('.slash-emoji-picker')).toHaveCount(0, { timeout: 10_000 });
      await expect(page.locator('[data-slash-emoji-preview="true"]')).toHaveCount(0);

      const editorText = await page.locator(EDITOR_SELECTOR).evaluate((editor) => editor.textContent ?? '');
      expect(editorText).not.toContain('/e');
      expect(editorText).not.toContain('🚀');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('closes the emoji picker when the editor cursor moves away without a selection', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-slash-emoji-close-on-cursor-move');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'slash-emoji-close-e2e.md',
        content: [
          '# Slash Emoji Close',
          '',
          'Move away from the picker anchor.',
        ].join('\n'),
      });

      await openSlashEmojiPickerFromEditorEnd(page);

      await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
      await page.keyboard.press('ArrowLeft');
      await expect(page.locator('.slash-emoji-picker')).toHaveCount(0, { timeout: 10_000 });
      await expect(page.locator('[data-slash-emoji-preview="true"]')).toHaveCount(0);

      const editorText = await page.locator(EDITOR_SELECTOR).evaluate((editor) => editor.textContent ?? '');
      expect(editorText).not.toContain('/e');
      expect(editorText).not.toContain('🚀');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('opens an emoji picker from /e and inserts the selected emoji', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-slash-emoji-command');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'slash-emoji-command-e2e.md',
        content: [
          '# Slash Emoji Command',
          '',
          'Type emoji below.',
        ].join('\n'),
      });

      await openSlashEmojiPickerFromEditorEnd(page);

      await page.getByPlaceholder(/Search emojis/i).fill('rocket');
      const rocket = page.locator('.slash-emoji-picker [data-icon="🚀"]').first();
      await expect(rocket).toBeVisible({ timeout: 10_000 });
      const beforeHover = await page.evaluate(() => ({
        content: String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? ''),
        selection: (window as any).__vlainaE2E.getEditorSelectionSummary?.() ?? null,
      }));
      const pickerRectBeforeHover = await page.locator('.slash-emoji-picker').evaluate((picker) => {
        const rect = picker.getBoundingClientRect();
        return { left: rect.left, top: rect.top };
      });
      await rocket.hover();
      await expect(page.locator(`${EDITOR_SELECTOR} [data-slash-emoji-preview="true"]`)).toHaveText('🚀');
      await expect(page.locator('.slash-emoji-preview')).toHaveCount(0);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('🚀');
      await waitForEditorAnimationFrame(page);
      const previewRect = await page.locator(`${EDITOR_SELECTOR} [data-slash-emoji-preview="true"]`).evaluate((preview) => {
        const textNode = Array.from(preview.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
        if (!textNode?.textContent) return null;
        const range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, textNode.textContent.length);
        const rect = range.getBoundingClientRect();
        range.detach();
        return { top: rect.top, height: rect.height };
      });
      const pickerRectAfterHover = await page.locator('.slash-emoji-picker').evaluate((picker) => {
        const rect = picker.getBoundingClientRect();
        return { left: rect.left, top: rect.top };
      });
      const hoverState = await page.evaluate(() => ({
        content: String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? ''),
        selection: (window as any).__vlainaE2E.getEditorSelectionSummary?.() ?? null,
      }));
      expect(hoverState.content).not.toContain('🚀');
      expect(hoverState.selection?.docTextLength).toBe(beforeHover.selection?.docTextLength);
      expect(Math.abs(pickerRectAfterHover.top - pickerRectBeforeHover.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(pickerRectAfterHover.left - pickerRectBeforeHover.left)).toBeLessThanOrEqual(1);
      await rocket.click();
      await expect(page.locator('.slash-emoji-picker')).toHaveCount(0, { timeout: 10_000 });
      await expect(page.locator('[data-slash-emoji-preview="true"]')).toHaveCount(0);
      await waitForEditorAnimationFrame(page);

      const insertedEmojiRect = await page.locator(EDITOR_SELECTOR).evaluate(getEmojiTextRangeRect, '🚀');
      const editorState = await page.locator(EDITOR_SELECTOR).evaluate((editor) => ({
        text: editor.textContent ?? '',
        activeClassName: document.activeElement instanceof HTMLElement
          ? document.activeElement.className
          : null,
        selection: (window as any).__vlainaE2E.getEditorSelectionSummary?.() ?? null,
      }));

      expect(editorState.text).toContain('🚀');
      expect(editorState.text).not.toContain('/e');
      expect(previewRect).not.toBeNull();
      expect(insertedEmojiRect).not.toBeNull();
      expect(Math.abs((insertedEmojiRect?.top ?? 0) - (previewRect?.top ?? 0))).toBeLessThanOrEqual(2);
      expect(String(editorState.activeClassName)).toContain('ProseMirror');
      expect(editorState.selection?.empty).toBe(true);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
