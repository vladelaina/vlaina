import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

type TextRangeRect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

function getEmojiTextRangeRect(editor: Element, emoji: string): TextRangeRect | null {
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
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      };
    }
    node = walker.nextNode();
  }
  return null;
}

function getTextRangeRect(editor: Element, text: string): TextRangeRect | null {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const content = node.textContent ?? '';
    const index = content.indexOf(text);
    if (index >= 0) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);
      const rect = range.getBoundingClientRect();
      range.detach();
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      };
    }
    node = walker.nextNode();
  }
  return null;
}

function getPrefixBeforeTextRangeRect(
  editor: Element,
  input: { prefix: string; text: string }
): TextRangeRect | null {
  const { prefix, text } = input;
  const combined = `${prefix}${text}`;
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const content = node.textContent ?? '';
    const index = content.indexOf(combined);
    if (index >= 0) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + prefix.length);
      const rect = range.getBoundingClientRect();
      range.detach();
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      };
    }
    node = walker.nextNode();
  }
  return null;
}

function expectTextRectStable(
  actual: TextRangeRect | null,
  expected: TextRangeRect | null,
  label: string,
  tolerance = 1
) {
  expect(actual, `${label} rect should exist`).not.toBeNull();
  expect(expected, `${label} baseline rect should exist`).not.toBeNull();
  expect(Math.abs((actual?.left ?? 0) - (expected?.left ?? 0)), `${label} left`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs((actual?.top ?? 0) - (expected?.top ?? 0)), `${label} top`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs((actual?.width ?? 0) - (expected?.width ?? 0)), `${label} width`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs((actual?.height ?? 0) - (expected?.height ?? 0)), `${label} height`).toBeLessThanOrEqual(tolerance);
}

function areTextRectsClose(
  actual: TextRangeRect | null,
  expected: TextRangeRect | null,
  tolerance = 1
) {
  return Boolean(
    actual &&
    expected &&
    Math.abs(actual.left - expected.left) <= tolerance &&
    Math.abs(actual.top - expected.top) <= tolerance &&
    Math.abs(actual.width - expected.width) <= tolerance &&
    Math.abs(actual.height - expected.height) <= tolerance
  );
}

async function waitForTextRangeRectStable(
  page: Page,
  text: string,
  label: string,
  timeoutMs = 10_000
): Promise<TextRangeRect> {
  const startedAt = Date.now();
  let previous: TextRangeRect | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    await waitForEditorAnimationFrame(page);
    const current = await page.locator(EDITOR_SELECTOR).evaluate(getTextRangeRect, text);
    if (areTextRectsClose(current, previous)) {
      return current!;
    }
    previous = current;
    await page.waitForTimeout(100);
  }

  throw new Error(`${label} text rect did not stabilize`);
}

async function getSlashEmojiPreviewTextRect(page: Page): Promise<TextRangeRect | null> {
  return page.locator(`${EDITOR_SELECTOR} [data-slash-emoji-preview="true"]`).evaluate((preview) => {
    const textNode = Array.from(preview.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
    if (!textNode?.textContent) return null;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, textNode.textContent.length);
    const rect = range.getBoundingClientRect();
    range.detach();
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
    };
  });
}

function expectEmojiPreviewAlignedToInsertion(
  previewRect: TextRangeRect | null,
  insertedRect: TextRangeRect | null,
  label: string,
  tolerance = 2
) {
  expect(previewRect, `${label} preview rect should exist`).not.toBeNull();
  expect(insertedRect, `${label} inserted rect should exist`).not.toBeNull();
  expect(Math.abs((previewRect?.left ?? 0) - (insertedRect?.left ?? 0)), `${label} left`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs((previewRect?.top ?? 0) - (insertedRect?.top ?? 0)), `${label} top`).toBeLessThanOrEqual(tolerance);
}

async function openSlashEmojiPickerFromEditorEnd(page: Page) {
  const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
  expect(focused).toBe(true);

  await page.keyboard.type('/e');
  await expect(page.locator('.slash-menu-item.selected')).toContainText('Emoji');
  await page.keyboard.press('Enter');
  await expect(page.locator('.slash-emoji-picker')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByPlaceholder(/Search emojis/i)).toBeVisible();
  await expect(page.locator('.slash-menu')).toHaveCount(0);
}

async function waitForMermaidRenderSettled(page: Page) {
  const mermaidBlock = page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"]`).first();
  await expect(mermaidBlock).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"][data-mermaid-lazy="true"]`)).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"] .mermaid-placeholder`)).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(page.locator(
    `${EDITOR_SELECTOR} [data-type="mermaid"] svg, ${EDITOR_SELECTOR} [data-type="mermaid"] .mermaid-error, ${EDITOR_SELECTOR} [data-type="mermaid"] .mermaid-empty`
  ).first()).toBeVisible({ timeout: 15_000 });
  await waitForEditorAnimationFrame(page);
}

async function openSlashEmojiPickerBeforeText(page: Page, targetText: string) {
  const selectionState = await page.evaluate(async (text) => {
    const bridge = (window as any).__vlainaE2E;
    const selected = await bridge.selectEditorTextByText(text, text);
    if (!selected.selected || selected.from === null) {
      return { selected, summary: null };
    }
    const summary = await bridge.setEditorSelectionRange(selected.from);
    return { selected, summary };
  }, targetText);
  expect(selectionState.selected.selected, `select ${targetText}`).toBe(true);
  expect(selectionState.summary?.empty, `collapse before ${targetText}`).toBe(true);

  await page.keyboard.type('/e');
  await expect(page.locator('.slash-menu-item.selected')).toContainText('Emoji');
  await page.keyboard.press('Enter');
  await expect(page.locator('.slash-emoji-picker')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByPlaceholder(/Search emojis/i)).toBeVisible();
  await waitForEditorAnimationFrame(page);
}

async function previewAndInsertRocketBeforeText(page: Page, targetText: string, label: string) {
  await openSlashEmojiPickerBeforeText(page, targetText);

  if (label.includes('mermaid')) {
    await waitForMermaidRenderSettled(page);
  }
  const baselineTargetRect = await waitForTextRangeRectStable(page, targetText, `${label} baseline target`);

  await page.getByPlaceholder(/Search emojis/i).fill('rocket');
  const rocket = page.locator('.slash-emoji-picker [data-icon="🚀"]').first();
  await expect(rocket, `${label} rocket option`).toBeVisible({ timeout: 10_000 });
  await rocket.hover();
  await expect(page.locator(`${EDITOR_SELECTOR} [data-slash-emoji-preview="true"]`)).toHaveText('🚀');
  await waitForEditorAnimationFrame(page);

  const hoverTargetRect = await page.locator(EDITOR_SELECTOR).evaluate(getTextRangeRect, targetText);
  const previewRect = await getSlashEmojiPreviewTextRect(page);
  expectTextRectStable(hoverTargetRect, baselineTargetRect, `${label} target text while previewing`);

  await rocket.click();
  await expect(page.locator('.slash-emoji-picker')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator('[data-slash-emoji-preview="true"]')).toHaveCount(0);
  await waitForEditorAnimationFrame(page);

  const insertedRect = await page.locator(EDITOR_SELECTOR).evaluate(getPrefixBeforeTextRangeRect, {
    prefix: '🚀',
    text: targetText,
  });
  const editorText = await page.locator(EDITOR_SELECTOR).evaluate((editor) => editor.textContent ?? '');
  expect(editorText, `${label} inserted text`).toContain(`🚀${targetText}`);
  expectEmojiPreviewAlignedToInsertion(previewRect, insertedRect, label);
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
      await rocket.hover();
      await expect(page.locator(`${EDITOR_SELECTOR} [data-slash-emoji-preview="true"]`)).toHaveText('🚀');
      await waitForEditorAnimationFrame(page);
      const inlinePreviewRect = await getSlashEmojiPreviewTextRect(page);
      await rocket.click();
      await expect(page.locator('.slash-emoji-picker')).toHaveCount(0, { timeout: 10_000 });
      await waitForEditorAnimationFrame(page);

      const editorText = await page.locator(EDITOR_SELECTOR).evaluate((editor) => editor.textContent ?? '');
      const inlineInsertedRect = await page.locator(EDITOR_SELECTOR).evaluate(getEmojiTextRangeRect, '🚀');
      expect(editorText).toContain('prefix🚀suffix');
      expect(editorText).not.toContain('prefix/esuffix');
      expectEmojiPreviewAlignedToInsertion(inlinePreviewRect, inlineInsertedRect, 'inline slash emoji preview');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps underlying editor text layout stable while hovering emoji previews', async () => {
    const trailingText = 'stableTrailingTextSentinel';
    const followingText = 'stableFollowingParagraphSentinel';
    const { app, userDataRoot } = await launchIsolatedElectron('notes-slash-emoji-hover-layout-stability');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'slash-emoji-hover-layout-stability-e2e.md',
        content: [
          '# Slash Emoji Hover Layout Stability',
          '',
          `Preview anchor prefix ${trailingText}`,
          '',
          followingText,
        ].join('\n'),
      });

      const selectionState = await page.evaluate(async (targetText) => {
        const bridge = (window as any).__vlainaE2E;
        const selected = await bridge.selectEditorTextByText(targetText, targetText);
        if (!selected.selected || selected.from === null) {
          return { selected, summary: null };
        }
        const summary = await bridge.setEditorSelectionRange(selected.from);
        return { selected, summary };
      }, trailingText);
      expect(selectionState.selected.selected).toBe(true);
      expect(selectionState.summary?.empty).toBe(true);

      await page.keyboard.type('/e');
      await expect(page.locator('.slash-menu-item.selected')).toContainText('Emoji');
      await page.keyboard.press('Enter');
      await expect(page.locator('.slash-emoji-picker')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('[data-slash-emoji-preview="true"]')).toHaveCount(0);
      await waitForEditorAnimationFrame(page);

      const baselineTrailingRect = await page.locator(EDITOR_SELECTOR).evaluate(getTextRangeRect, trailingText);
      const baselineFollowingRect = await page.locator(EDITOR_SELECTOR).evaluate(getTextRangeRect, followingText);
      expect(baselineTrailingRect).not.toBeNull();
      expect(baselineFollowingRect).not.toBeNull();

      const emojiButtons = page.locator('.slash-emoji-picker [data-icon]');
      await expect(emojiButtons.first()).toBeVisible({ timeout: 10_000 });
      const hoverCount = Math.min(await emojiButtons.count(), 6);
      expect(hoverCount).toBeGreaterThanOrEqual(3);

      for (let index = 0; index < hoverCount; index += 1) {
        const button = emojiButtons.nth(index);
        const icon = await button.getAttribute('data-icon');
        expect(icon).toBeTruthy();

        await button.hover();
        await expect(page.locator(`${EDITOR_SELECTOR} [data-slash-emoji-preview="true"]`)).toHaveText(icon ?? '');
        await waitForEditorAnimationFrame(page);

        const trailingRect = await page.locator(EDITOR_SELECTOR).evaluate(getTextRangeRect, trailingText);
        const followingRect = await page.locator(EDITOR_SELECTOR).evaluate(getTextRangeRect, followingText);
        expectTextRectStable(trailingRect, baselineTrailingRect, `hover ${index + 1} trailing text`);
        expectTextRectStable(followingRect, baselineFollowingRect, `hover ${index + 1} following text`);
      }

      await page.getByPlaceholder(/Search emojis/i).hover();
      await expect(page.locator('[data-slash-emoji-preview="true"]')).toHaveCount(0);
      await waitForEditorAnimationFrame(page);

      const clearedTrailingRect = await page.locator(EDITOR_SELECTOR).evaluate(getTextRangeRect, trailingText);
      const clearedFollowingRect = await page.locator(EDITOR_SELECTOR).evaluate(getTextRangeRect, followingText);
      expectTextRectStable(clearedTrailingRect, baselineTrailingRect, 'cleared trailing text');
      expectTextRectStable(clearedFollowingRect, baselineFollowingRect, 'cleared following text');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps emoji preview aligned across supported markdown syntax contexts', async () => {
    const cases = [
      { label: 'heading', text: 'HeadingEmojiAuditTarget' },
      { label: 'blockquote', text: 'QuoteEmojiAuditTarget' },
      { label: 'bullet list', text: 'BulletEmojiAuditTarget' },
      { label: 'ordered list', text: 'OrderedEmojiAuditTarget' },
      { label: 'task list', text: 'TaskEmojiAuditTarget' },
      { label: 'callout', text: 'CalloutEmojiAuditTarget' },
      { label: 'table cell', text: 'TableEmojiAuditTarget' },
      { label: 'inline math neighbor', text: 'InlineMathEmojiAuditTarget' },
      { label: 'footnote reference neighbor', text: 'FootnoteRefEmojiAuditTarget' },
      { label: 'math block neighbor', text: 'MathBlockEmojiAuditTarget' },
      { label: 'mermaid block neighbor', text: 'MermaidEmojiAuditTarget' },
      { label: 'html block neighbor', text: 'HtmlEmojiAuditTarget' },
    ];
    const { app, userDataRoot } = await launchIsolatedElectron('notes-slash-emoji-syntax-contexts');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 900 });

      await openMarkdownFixture(page, {
        filename: 'slash-emoji-syntax-contexts-e2e.md',
        content: [
          '# Slash Emoji Syntax Contexts',
          '',
          '## HeadingEmojiAuditTarget',
          '',
          '> QuoteEmojiAuditTarget',
          '',
          '- BulletEmojiAuditTarget',
          '',
          '1. OrderedEmojiAuditTarget',
          '',
          '- [ ] TaskEmojiAuditTarget',
          '',
          '> [!NOTE]',
          '> CalloutEmojiAuditTarget',
          '',
          '| Column A | Column B |',
          '| --- | --- |',
          '| TableEmojiAuditTarget | Table neighbor |',
          '',
          'Inline math $x + y$ InlineMathEmojiAuditTarget',
          '',
          'Footnote reference[^1] FootnoteRefEmojiAuditTarget',
          '',
          '[^1]: Footnote body sentinel.',
          '',
          '$$',
          'x = y',
          '$$',
          '',
          'MathBlockEmojiAuditTarget',
          '',
          '```mermaid',
          'graph TD',
          '  A --> B',
          '```',
          '',
          'MermaidEmojiAuditTarget',
          '',
          '<div>',
          'HTML block audit sentinel',
          '</div>',
          '',
          'HtmlEmojiAuditTarget',
        ].join('\n'),
      });

      for (const item of cases) {
        await previewAndInsertRocketBeforeText(page, item.text, item.label);
      }

      const editorText = await page.locator(EDITOR_SELECTOR).evaluate((editor) => editor.textContent ?? '');
      const selection = await page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary?.() ?? null);
      for (const item of cases) {
        expect(editorText, `${item.label} editor text`).toContain(`🚀${item.text}`);
      }
      expect(editorText).not.toContain('/e');
      expect(selection?.empty).toBe(true);
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
      const previewRect = await getSlashEmojiPreviewTextRect(page);
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
      expectEmojiPreviewAlignedToInsertion(previewRect, insertedEmojiRect, 'slash emoji preview');
      expect(String(editorState.activeClassName)).toContain('ProseMirror');
      expect(editorState.selection?.empty).toBe(true);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
