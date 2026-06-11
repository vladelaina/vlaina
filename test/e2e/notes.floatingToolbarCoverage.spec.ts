import { expect, test, type Page } from '@playwright/test';
import {
  CHAT_COMPOSER_TEXTAREA_SELECTOR,
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

const TOOLBAR_SELECTOR = '.floating-toolbar.visible';
const LIVE_EDITOR_SELECTOR = `${EDITOR_SELECTOR}:not(.toolbar-applied-preview-overlay):not([aria-hidden="true"])`;
const PREVIEW_OVERLAY_SELECTOR = '.toolbar-applied-preview-overlay';
const LARGE_PREVIEW_DOC_MIN_LENGTH = 300_000;

type ToolbarMarkCase = {
  action: string;
  markName: string;
  selector: string;
  target: string;
};

type BlockCase = {
  blockType: string;
  selector: string;
  target: string;
};

async function hideToolbar(page: Page) {
  await page.keyboard.press('Escape');
  await waitForEditorAnimationFrame(page);
}

async function selectEditorText(page: Page, text: string) {
  const selected = await page.evaluate(
    (targetText) => (window as any).__vlainaE2E.selectEditorTextByText(targetText, targetText),
    text,
  );

  if (!selected.selected) {
    const debugState = await page.evaluate((targetText) => {
      const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
      return {
        targetText,
        editorHasText: editor?.textContent?.includes(targetText) ?? false,
        selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
        toolbar: (window as any).__vlainaE2E.getEditorToolbarDebugState(),
      };
    }, text);
    console.info('[notes-floating-toolbar-selection-debug]', debugState);
  }

  expect(selected.selected, `Expected to select ${text}`).toBe(true);
  await expect(page.locator(TOOLBAR_SELECTOR)).toBeVisible({ timeout: 5_000 });
}

async function dragSelectEditorText(page: Page, text: string) {
  const rect = await page.evaluate((targetText) => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    if (!editor) return null;

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const content = node.textContent ?? '';
      const index = content.indexOf(targetText);
      if (index >= 0) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + targetText.length);
        const targetRect = Array.from(range.getClientRects()).find((item) => item.width > 1 && item.height > 1);
        range.detach();
        if (!targetRect) return null;
        return {
          left: targetRect.left,
          right: targetRect.right,
          y: targetRect.top + targetRect.height / 2,
        };
      }
      node = walker.nextNode();
    }

    return null;
  }, text);

  expect(rect, `Expected text rect for ${text}`).not.toBeNull();
  await page.mouse.move(rect!.left + 1, rect!.y);
  await page.mouse.down();
  await page.mouse.move(rect!.right - 1, rect!.y, { steps: 12 });
  await page.mouse.up();
  await waitForEditorAnimationFrame(page);
  await expect(page.locator(TOOLBAR_SELECTOR)).toBeVisible({ timeout: 5_000 });
  await expect.poll(() => page.evaluate(() => {
    const summary = (window as any).__vlainaE2E.getEditorSelectionSummary();
    return summary?.selectedText ?? '';
  }), {
    message: `Expected native mouse selection for ${text}`,
  }).toBe(text);
}

async function clickToolbarAction(page: Page, action: string) {
  const button = page.locator(`${TOOLBAR_SELECTOR} [data-action="${action}"]`).first();
  await expect(button, `Expected toolbar action ${action}`).toBeVisible({ timeout: 5_000 });
  await button.click();
  await waitForEditorAnimationFrame(page);
}

async function clickVisibleElement(page: Page, selector: string, description: string) {
  const element = page.locator(selector).first();
  await expect(element, `Expected ${description}`).toBeVisible({ timeout: 5_000 });
  await element.scrollIntoViewIfNeeded();
  await waitForEditorAnimationFrame(page);
  await element.click();
  await waitForEditorAnimationFrame(page);
}

async function editorTextHasMark(page: Page, text: string, markName: string) {
  return page.evaluate(
    ({ targetText, targetMark }) => (
      window as any
    ).__vlainaE2E.editorTextHasMark(targetText, targetMark, targetText),
    { targetText: text, targetMark: markName },
  );
}

async function expectEditorTextMark(page: Page, testCase: ToolbarMarkCase) {
  await expect
    .poll(() => editorTextHasMark(page, testCase.target, testCase.markName), {
      message: `Expected ${testCase.target} to have ${testCase.markName}`,
    })
    .toBe(true);
  await expect(page.locator(testCase.selector, { hasText: testCase.target }))
    .toBeVisible({ timeout: 5_000 });
}

async function countEditorTextOccurrences(page: Page, text: string) {
  return page.evaluate((targetText) => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    const content = editor?.textContent ?? '';
    let count = 0;
    let index = content.indexOf(targetText);
    while (index >= 0) {
      count += 1;
      index = content.indexOf(targetText, index + targetText.length);
    }
    return count;
  }, text);
}

async function focusEditorAtEnd(page: Page) {
  const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
  expect(focused).toBe(true);
  await waitForEditorAnimationFrame(page);
}

async function clickBlockDropdownItem(page: Page, blockType: string) {
  await clickToolbarAction(page, 'block');
  await clickVisibleElement(
    page,
    `.block-dropdown [data-block-type="${blockType}"]`,
    `${blockType} block dropdown item`,
  );
}

async function clickAlignmentDropdownItem(page: Page, alignment: string) {
  await clickToolbarAction(page, 'alignment');
  await clickVisibleElement(
    page,
    `.alignment-dropdown [data-alignment="${alignment}"]`,
    `${alignment} alignment item`,
  );
}

async function clickColorSwatch(page: Page, type: 'text' | 'bg', swatchSelector: string, description: string) {
  await clickToolbarAction(page, 'color');
  await clickVisibleElement(
    page,
    `.color-picker [data-type="${type}"] ${swatchSelector}`,
    description,
  );
}

async function clickEditorBlankArea(page: Page) {
  const editor = page.locator(LIVE_EDITOR_SELECTOR).first();
  await expect(editor).toBeVisible({ timeout: 5_000 });
  const box = await editor.boundingBox();
  expect(box, 'Expected editor bounding box').not.toBeNull();
  await page.mouse.click(box!.x + Math.max(8, box!.width - 16), box!.y + 24);
  await waitForEditorAnimationFrame(page);
}

async function expectSelectionOverlay(page: Page, text: string) {
  await expect.poll(() => page.evaluate((targetText) => {
    const editor = document.querySelector<HTMLElement>(
      '.milkdown .ProseMirror:not(.toolbar-applied-preview-overlay):not([aria-hidden="true"])'
    );
    const summary = (window as any).__vlainaE2E.getEditorSelectionSummary();
    const overlayCount = editor?.querySelectorAll('.editor-text-selection-overlay').length ?? 0;
    const overlayActive = editor?.classList.contains('editor-text-selection-overlay-active') ?? false;
    const nativeSelectionActive = editor?.classList.contains('editor-pointer-native-selection') ?? false;
    return (
      summary?.selectedText === targetText &&
      (overlayCount > 0 || (overlayActive && !nativeSelectionActive))
    );
  }, text), {
    message: `Expected visible selection overlay for ${text}`,
  }).toBe(true);
}

function createToolbarCoverageMarkdown() {
  const targets = [
    'AI toolbar menu target',
    'Bold toolbar target',
    'Italic toolbar target',
    'Underline toolbar target',
    'Strike toolbar target',
    'Code toolbar target',
    'Highlight toolbar target',
    'Mouse link focus target',
    'Link outside close target',
    'Link toolbar target',
    'Link check button target',
    'Link plain href target',
    'Text color toolbar target',
    'Background color toolbar target',
    'Heading one toolbar target',
    'Heading two toolbar target',
    'Heading three toolbar target',
    'Heading four toolbar target',
    'Heading five toolbar target',
    'Heading six toolbar target',
    'Bullet list toolbar target',
    'Ordered list toolbar target',
    'Task list toolbar target',
    'Blockquote toolbar target',
    'Code block toolbar target',
    'Paragraph toolbar target',
    'Align center toolbar target',
    'Align right toolbar target',
    'Align left toolbar target',
    'Copy toolbar target',
    'Delete toolbar target',
  ];

  return [
    '# Floating Toolbar E2E Coverage',
    '',
    ...targets.flatMap((target) => [`${target} baseline text.`, '']),
    '[Existing link edit target](https://example.com/notes-floating-toolbar-existing-old)! trailing sentinel.',
    '',
  ].join('\n');
}

function createLargeToolbarPreviewMarkdown(): { content: string; target: string } {
  const target = 'Large toolbar preview target sentinel';
  const lines = ['# Large Toolbar Preview Coverage', '', `${target} should stay selectable in a long note.`, ''];

  for (let index = 0; index < 900; index += 1) {
    lines.push(
      [
        `Large toolbar preview paragraph ${index}.`,
        'This repeated prose is intentionally plain so toolbar hover preview performance is dominated by the editor document size.',
        'It includes markdown-looking tokens like **bold**, ==highlight==, [link](https://example.com), and `code`.',
        'The paragraph is long enough to make a realistic note without relying on external assets.',
      ].join(' '),
    );
    lines.push('');
  }

  return { content: lines.join('\n'), target };
}

async function collectPreviewFrameMetrics(page: Page, durationMs: number) {
  return page.evaluate(({ durationMs, previewSelector, editorSelector }) => new Promise<{
    frameCount: number;
    maxFrameMs: number;
    previewOverlayCount: number;
    hiddenEditorCount: number;
  }>((resolve) => {
    let frameCount = 0;
    let maxFrameMs = 0;
    const startedAt = performance.now();
    let lastFrameAt = startedAt;

    const collect = () => {
      const now = performance.now();
      frameCount += 1;
      maxFrameMs = Math.max(maxFrameMs, now - lastFrameAt);
      lastFrameAt = now;

      if (now - startedAt >= durationMs) {
        resolve({
          frameCount,
          maxFrameMs: Math.round(maxFrameMs * 10) / 10,
          previewOverlayCount: document.querySelectorAll(previewSelector).length,
          hiddenEditorCount: document.querySelectorAll(`${editorSelector}[data-toolbar-preview-hidden="true"]`).length,
        });
        return;
      }

      requestAnimationFrame(collect);
    };

    requestAnimationFrame(collect);
  }), {
    durationMs,
    previewSelector: PREVIEW_OVERLAY_SELECTOR,
    editorSelector: EDITOR_SELECTOR,
  });
}

test.describe('notes floating toolbar coverage', () => {
  test.setTimeout(240_000);

  test('covers selection toolbar actions, dropdowns, copy, and delete', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-floating-toolbar-coverage');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await openMarkdownFixture(page, {
        filename: 'floating-toolbar-coverage.md',
        content: createToolbarCoverageMarkdown(),
      });

      await selectEditorText(page, 'AI toolbar menu target');
      await clickToolbarAction(page, 'ai');
      await expect(page.locator('.ai-dropdown')).toBeVisible({ timeout: 5_000 });
      await expect(page.locator('.ai-dropdown [data-ai-prompt], .ai-dropdown [data-ai-category]').first())
        .toBeVisible({ timeout: 5_000 });
      await expect(page.locator('.ai-dropdown [data-ai-command-id="fix-typos"]')).toBeVisible({ timeout: 5_000 });
      const quoteToChatAction = page.locator('.ai-dropdown .ai-dropdown-category-action[data-ai-command-id="discuss-in-sidebar"]').first();
      await expect(quoteToChatAction).toBeVisible({ timeout: 5_000 });
      await expect(quoteToChatAction.locator('.ai-dropdown-item-icon')).toHaveCount(0);
      await quoteToChatAction.click();
      await expect(page.locator('[data-notes-chat-floating="true"]')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('[data-notes-chat-panel="true"]')).toHaveCount(0);
      await expect(page.locator(`[data-notes-chat-floating="true"] ${CHAT_COMPOSER_TEXTAREA_SELECTOR}`).first())
        .toHaveValue('AI toolbar menu target', { timeout: 10_000 });
      await page.locator('[data-notes-chat-floating="true"] [data-chat-view-mode="embedded"] > div').first()
        .locator('button[aria-label]')
        .last()
        .click();
      await expect(page.locator('[data-notes-chat-floating="true"]')).toHaveCount(0);
      await hideToolbar(page);

      const markCases: ToolbarMarkCase[] = [
        {
          action: 'bold',
          markName: 'strong',
          selector: `${LIVE_EDITOR_SELECTOR} strong`,
          target: 'Bold toolbar target',
        },
        {
          action: 'italic',
          markName: 'emphasis',
          selector: `${LIVE_EDITOR_SELECTOR} em`,
          target: 'Italic toolbar target',
        },
        {
          action: 'underline',
          markName: 'underline',
          selector: `${LIVE_EDITOR_SELECTOR} u`,
          target: 'Underline toolbar target',
        },
        {
          action: 'strike',
          markName: 'strike_through',
          selector: `${LIVE_EDITOR_SELECTOR} s, ${LIVE_EDITOR_SELECTOR} del, ${LIVE_EDITOR_SELECTOR} strike`,
          target: 'Strike toolbar target',
        },
        {
          action: 'code',
          markName: 'inlineCode',
          selector: `${LIVE_EDITOR_SELECTOR} code`,
          target: 'Code toolbar target',
        },
        {
          action: 'highlight',
          markName: 'highlight',
          selector: `${LIVE_EDITOR_SELECTOR} mark`,
          target: 'Highlight toolbar target',
        },
      ];

      for (const markCase of markCases) {
        await selectEditorText(page, markCase.target);
        await clickToolbarAction(page, markCase.action);
        await expectEditorTextMark(page, markCase);
      }

      const mouseLinkTarget = 'Mouse link focus target';
      const mouseLinkHref = 'mouse-link-focus';
      await dragSelectEditorText(page, mouseLinkTarget);
      await clickToolbarAction(page, 'link');
      const mouseLinkInput = page.locator('.link-tooltip-container textarea').first();
      await expect(mouseLinkInput).toBeVisible({ timeout: 5_000 });
      await expect(mouseLinkInput).toBeFocused({ timeout: 5_000 });
      await expectSelectionOverlay(page, mouseLinkTarget);
      await page.keyboard.type(mouseLinkHref);
      await expect(mouseLinkInput).toHaveValue(mouseLinkHref);
      await page.locator('.link-tooltip-container .link-tooltip-action-btn').first().click();
      await waitForEditorAnimationFrame(page);
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} a[href="${mouseLinkHref}"]`, { hasText: mouseLinkTarget }))
        .toBeVisible({ timeout: 5_000 });
      await expect.poll(() => editorTextHasMark(page, mouseLinkTarget, 'link')).toBe(true);

      const linkOutsideTarget = 'Link outside close target';
      await selectEditorText(page, linkOutsideTarget);
      await clickToolbarAction(page, 'link');
      const blankCloseLinkInput = page.locator('.link-tooltip-container textarea').first();
      await expect(blankCloseLinkInput).toBeVisible({ timeout: 5_000 });
      await expect(blankCloseLinkInput).toHaveAttribute('placeholder', 'URL...');
      await expect(blankCloseLinkInput).toBeFocused({ timeout: 5_000 });
      await expectSelectionOverlay(page, linkOutsideTarget);
      await clickEditorBlankArea(page);
      await expect(blankCloseLinkInput).not.toBeVisible({ timeout: 5_000 });
      await expect(page.locator(TOOLBAR_SELECTOR)).not.toBeVisible({ timeout: 5_000 });
      await expect.poll(() => page.evaluate(() => {
        const summary = (window as any).__vlainaE2E.getEditorSelectionSummary();
        return summary?.empty === true && summary.selectedText === '';
      })).toBe(true);
      await expect.poll(() => editorTextHasMark(page, linkOutsideTarget, 'link')).toBe(false);

      const linkTarget = 'Link toolbar target';
      const linkUrl = 'https://example.com/notes-floating-toolbar-link';
      await selectEditorText(page, linkTarget);
      await clickToolbarAction(page, 'link');
      const linkInput = page.locator('.link-tooltip-container textarea').first();
      await expect(linkInput).toBeVisible({ timeout: 5_000 });
      await page.keyboard.type(linkUrl);
      await expect(linkInput).toHaveValue(linkUrl);
      await linkInput.press('Enter');
      await waitForEditorAnimationFrame(page);
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} a[href="${linkUrl}"]`, { hasText: linkTarget }))
        .toBeVisible({ timeout: 5_000 });
      await expect.poll(() => editorTextHasMark(page, linkTarget, 'link')).toBe(true);

      const linkCheckTarget = 'Link check button target';
      const linkCheckUrl = 'https://example.com/notes-floating-toolbar-check';
      await selectEditorText(page, linkCheckTarget);
      await clickToolbarAction(page, 'link');
      const linkCheckInput = page.locator('.link-tooltip-container textarea').first();
      await expect(linkCheckInput).toBeVisible({ timeout: 5_000 });
      await page.keyboard.type(linkCheckUrl);
      await expect(linkCheckInput).toHaveValue(linkCheckUrl);
      await page.locator('.link-tooltip-container .link-tooltip-action-btn').first().click();
      await waitForEditorAnimationFrame(page);
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} a[href="${linkCheckUrl}"]`, { hasText: linkCheckTarget }))
        .toBeVisible({ timeout: 5_000 });
      await expect.poll(() => editorTextHasMark(page, linkCheckTarget, 'link')).toBe(true);

      const linkPlainTarget = 'Link plain href target';
      const linkPlainHref = 'workspace-note';
      await selectEditorText(page, linkPlainTarget);
      await clickToolbarAction(page, 'link');
      const linkPlainInput = page.locator('.link-tooltip-container textarea').first();
      await expect(linkPlainInput).toBeVisible({ timeout: 5_000 });
      await page.keyboard.type(linkPlainHref);
      await expect(linkPlainInput).toHaveValue(linkPlainHref);
      await page.locator('.link-tooltip-container .link-tooltip-action-btn').first().click();
      await waitForEditorAnimationFrame(page);
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} a[href="${linkPlainHref}"]`, { hasText: linkPlainTarget }))
        .toBeVisible({ timeout: 5_000 });
      await expect.poll(() => editorTextHasMark(page, linkPlainTarget, 'link')).toBe(true);

      const existingLinkTarget = 'Existing link edit target';
      const existingLinkUpdatedHref = 'workspace-existing-link';
      const existingLink = page.locator(
        `${LIVE_EDITOR_SELECTOR} a[href="https://example.com/notes-floating-toolbar-existing-old"]`,
        { hasText: existingLinkTarget },
      ).first();
      await expect(existingLink).toBeVisible({ timeout: 5_000 });
      await existingLink.hover();
      await expect(page.locator('.link-tooltip-container .link-tooltip-viewer')).toBeVisible({ timeout: 5_000 });
      await page.locator('.link-tooltip-container .link-tooltip-action-btn').nth(1).click();
      const existingLinkInput = page.locator('.link-tooltip-container textarea').first();
      await expect(existingLinkInput).toBeVisible({ timeout: 5_000 });
      await existingLinkInput.press('Control+A');
      await page.keyboard.type(existingLinkUpdatedHref);
      await expect(existingLinkInput).toHaveValue(existingLinkUpdatedHref);
      await page.locator('.link-tooltip-container .link-tooltip-action-btn').first().click();
      await waitForEditorAnimationFrame(page);
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} a[href="${existingLinkUpdatedHref}"]`, { hasText: existingLinkTarget }))
        .toBeVisible({ timeout: 5_000 });
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} p`, { hasText: `${existingLinkTarget}! trailing sentinel.` }))
        .toBeVisible({ timeout: 5_000 });

      const textColorTarget = 'Text color toolbar target';
      await selectEditorText(page, textColorTarget);
      await clickColorSwatch(
        page,
        'text',
        '.color-picker-grid .color-picker-item:not(.color-picker-item-default)',
        'text color swatch',
      );
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} span[data-text-color]`, { hasText: textColorTarget }))
        .toBeVisible({ timeout: 5_000 });
      await expect.poll(() => editorTextHasMark(page, textColorTarget, 'textColor')).toBe(true);
      await selectEditorText(page, textColorTarget);
      await clickColorSwatch(page, 'text', '.color-picker-item-default', 'default text color swatch');
      await expect.poll(() => editorTextHasMark(page, textColorTarget, 'textColor')).toBe(false);

      const bgColorTarget = 'Background color toolbar target';
      await selectEditorText(page, bgColorTarget);
      await clickColorSwatch(
        page,
        'bg',
        '.color-picker-grid .color-picker-item:not(.color-picker-item-default)',
        'background color swatch',
      );
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} mark[data-bg-color]`, { hasText: bgColorTarget }))
        .toBeVisible({ timeout: 5_000 });
      await expect.poll(() => editorTextHasMark(page, bgColorTarget, 'bgColor')).toBe(true);
      await selectEditorText(page, bgColorTarget);
      await clickColorSwatch(page, 'bg', '.color-picker-item-default', 'default background color swatch');
      await expect.poll(() => editorTextHasMark(page, bgColorTarget, 'bgColor')).toBe(false);

      const blockCases: BlockCase[] = [
        { blockType: 'heading1', selector: `${LIVE_EDITOR_SELECTOR} h1`, target: 'Heading one toolbar target' },
        { blockType: 'heading2', selector: `${LIVE_EDITOR_SELECTOR} h2`, target: 'Heading two toolbar target' },
        { blockType: 'heading3', selector: `${LIVE_EDITOR_SELECTOR} h3`, target: 'Heading three toolbar target' },
        { blockType: 'heading4', selector: `${LIVE_EDITOR_SELECTOR} h4`, target: 'Heading four toolbar target' },
        { blockType: 'heading5', selector: `${LIVE_EDITOR_SELECTOR} h5`, target: 'Heading five toolbar target' },
        { blockType: 'heading6', selector: `${LIVE_EDITOR_SELECTOR} h6`, target: 'Heading six toolbar target' },
        { blockType: 'bulletList', selector: `${LIVE_EDITOR_SELECTOR} ul li`, target: 'Bullet list toolbar target' },
        { blockType: 'orderedList', selector: `${LIVE_EDITOR_SELECTOR} ol li`, target: 'Ordered list toolbar target' },
        {
          blockType: 'taskList',
          selector: `${LIVE_EDITOR_SELECTOR} li[data-item-type="task"], ${LIVE_EDITOR_SELECTOR} li[data-task-list-item], ${LIVE_EDITOR_SELECTOR} li.task-list-item`,
          target: 'Task list toolbar target',
        },
        { blockType: 'blockquote', selector: `${LIVE_EDITOR_SELECTOR} blockquote`, target: 'Blockquote toolbar target' },
        {
          blockType: 'codeBlock',
          selector: `${LIVE_EDITOR_SELECTOR} .code-block-container, ${LIVE_EDITOR_SELECTOR} pre`,
          target: 'Code block toolbar target',
        },
      ];

      for (const blockCase of blockCases) {
        await selectEditorText(page, blockCase.target);
        await clickBlockDropdownItem(page, blockCase.blockType);
        await expect(page.locator(blockCase.selector, { hasText: blockCase.target }))
          .toBeVisible({ timeout: 5_000 });
      }

      const paragraphTarget = 'Paragraph toolbar target';
      await selectEditorText(page, paragraphTarget);
      await clickBlockDropdownItem(page, 'heading2');
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} h2`, { hasText: paragraphTarget }))
        .toBeVisible({ timeout: 5_000 });
      await selectEditorText(page, paragraphTarget);
      await clickBlockDropdownItem(page, 'paragraph');
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} p`, { hasText: paragraphTarget }))
        .toBeVisible({ timeout: 5_000 });

      const alignCenterTarget = 'Align center toolbar target';
      await selectEditorText(page, alignCenterTarget);
      await clickAlignmentDropdownItem(page, 'center');
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} [data-text-align="center"]`, { hasText: alignCenterTarget }))
        .toBeVisible({ timeout: 5_000 });

      const alignRightTarget = 'Align right toolbar target';
      await selectEditorText(page, alignRightTarget);
      await clickAlignmentDropdownItem(page, 'right');
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} [data-text-align="right"]`, { hasText: alignRightTarget }))
        .toBeVisible({ timeout: 5_000 });

      const alignLeftTarget = 'Align left toolbar target';
      await selectEditorText(page, alignLeftTarget);
      await clickAlignmentDropdownItem(page, 'center');
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} [data-text-align="center"]`, { hasText: alignLeftTarget }))
        .toBeVisible({ timeout: 5_000 });
      await selectEditorText(page, alignLeftTarget);
      await clickAlignmentDropdownItem(page, 'left');
      await expect(page.locator(`${LIVE_EDITOR_SELECTOR} [data-text-align="center"]`, { hasText: alignLeftTarget }))
        .toHaveCount(0);

      const copyTarget = 'Copy toolbar target';
      const beforeCopyCount = await countEditorTextOccurrences(page, copyTarget);
      await selectEditorText(page, copyTarget);
      await clickToolbarAction(page, 'copy');
      await focusEditorAtEnd(page);
      await page.keyboard.press('Control+V');
      await waitForEditorAnimationFrame(page);
      await expect.poll(() => countEditorTextOccurrences(page, copyTarget)).toBeGreaterThan(beforeCopyCount);

      const deleteTarget = 'Delete toolbar target';
      const beforeDeleteCount = await countEditorTextOccurrences(page, deleteTarget);
      await selectEditorText(page, deleteTarget);
      await clickToolbarAction(page, 'delete');
      await expect.poll(() => countEditorTextOccurrences(page, deleteTarget)).toBeLessThan(beforeDeleteCount);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps toolbar hover preview responsive in a large note', async () => {
    const { content, target } = createLargeToolbarPreviewMarkdown();
    expect(content.length).toBeGreaterThan(LARGE_PREVIEW_DOC_MIN_LENGTH);

    const { app, userDataRoot } = await launchIsolatedElectron('notes-floating-toolbar-large-preview');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const opened = await openMarkdownFixture(page, {
        filename: 'floating-toolbar-large-preview.md',
        content,
      });

      await selectEditorText(page, target);
      const boldButton = page.locator(`${TOOLBAR_SELECTOR} [data-action="bold"]`).first();
      await expect(boldButton).toBeVisible({ timeout: 5_000 });

      const framesPromise = collectPreviewFrameMetrics(page, 900);
      const hoverStartedAt = Date.now();
      await boldButton.hover();
      const hoverGestureMs = Date.now() - hoverStartedAt;
      const frameMetrics = await framesPromise;

      console.info('[notes-floating-toolbar-large-preview]', {
        contentLength: content.length,
        opened,
        hoverGestureMs,
        frameMetrics,
      });

      expect(hoverGestureMs).toBeLessThan(1_200);
      expect(frameMetrics.frameCount).toBeGreaterThan(5);
      expect(frameMetrics.maxFrameMs).toBeLessThan(350);
      expect(frameMetrics.previewOverlayCount).toBe(0);
      expect(frameMetrics.hiddenEditorCount).toBe(0);

      await clickToolbarAction(page, 'bold');
      await expect.poll(() => editorTextHasMark(page, target, 'strong')).toBe(true);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
