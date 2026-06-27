import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

const SELECTED_NODE_SELECTOR = `${EDITOR_SELECTOR} .ProseMirror-selectednode`;
const REAL_HTML_BLOCK_SELECTOR = `${EDITOR_SELECTOR} [data-type="html-block"]:not([data-value="<!--vlaina-markdown-blank-line-->"]):not([data-value="<!--vlaina-markdown-tight-heading-->"])`;

async function clickParagraphText(page: import('@playwright/test').Page, text: string) {
  const paragraph = page.locator(`${EDITOR_SELECTOR} p`, { hasText: text }).first();
  await expect(paragraph).toBeVisible();
  const box = await paragraph.boundingBox();
  expect(box, `Expected paragraph box for ${text}`).not.toBeNull();
  await page.mouse.click(box!.x + Math.min(24, box!.width / 2), box!.y + box!.height / 2);
  await waitForEditorAnimationFrame(page);
}

async function placeCaretAfterText(page: import('@playwright/test').Page, text: string) {
  const selected = await page.evaluate(
    (targetText) => (window as any).__vlainaE2E.selectEditorTextByText(targetText, targetText),
    text,
  );
  expect(selected.selected, { selected }).toBe(true);
  await page.keyboard.press('ArrowRight');
  await waitForEditorAnimationFrame(page);
}

async function captureCaretState(page: import('@playwright/test').Page) {
  await waitForEditorAnimationFrame(page);
  await waitForEditorAnimationFrame(page);
  return page.evaluate(({ selectedNodeSelector }) => {
    const selection = (window as any).__vlainaE2E.getEditorSelectionSummary();
    const selectedNodes = Array.from(document.querySelectorAll<HTMLElement>(selectedNodeSelector))
      .map((node) => ({
        tagName: node.tagName,
        className: node.className,
        dataType: node.dataset.type ?? '',
        text: node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      }));
    const domSelection = document.getSelection();
    const anchorNode = domSelection?.anchorNode;
    const anchorElement = anchorNode instanceof HTMLElement
      ? anchorNode
      : anchorNode?.parentElement ?? null;
    return {
      selection,
      selectedNodes,
      domAnchor: anchorElement
        ? {
            tagName: anchorElement.tagName,
            className: anchorElement.className,
            dataType: anchorElement.dataset.type ?? '',
            text: anchorElement.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100) ?? '',
            closestBlockType: anchorElement.closest<HTMLElement>('[data-type]')?.dataset.type ?? '',
            previousSiblingType: anchorElement.previousElementSibling instanceof HTMLElement
              ? anchorElement.previousElementSibling.dataset.type ?? anchorElement.previousElementSibling.tagName
              : '',
            nextSiblingType: anchorElement.nextElementSibling instanceof HTMLElement
              ? anchorElement.nextElementSibling.dataset.type ?? anchorElement.nextElementSibling.tagName
              : '',
          }
        : null,
    };
  }, { selectedNodeSelector: SELECTED_NODE_SELECTOR });
}

async function captureHoverStyle(
  page: import('@playwright/test').Page,
  selector: string,
) {
  const element = page.locator(selector).first();
  await expect(element).toBeVisible();
  let lastStyle: {
    backgroundColor: string;
    boxShadow: string;
    cursor: string;
  } | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await element.scrollIntoViewIfNeeded();
    const box = await element.boundingBox();
    expect(box, `Expected hover target box for ${selector}`).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await waitForEditorAnimationFrame(page);
    await page.waitForTimeout(120);
    lastStyle = await element.evaluate((node) => {
      const style = window.getComputedStyle(node);
      return {
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        cursor: style.cursor,
      };
    });
    if (
      lastStyle.cursor === 'pointer' &&
      lastStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
      lastStyle.boxShadow !== 'none'
    ) {
      return lastStyle;
    }
  }

  expect(lastStyle, `Expected hover style for ${selector}`).not.toBeNull();
  return lastStyle!;
}

async function captureEditorScrollTop(page: import('@playwright/test').Page) {
  return page.evaluate(({ editorSelector }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const candidates: HTMLElement[] = [];
    let element = editor;
    while (element) {
      candidates.push(element);
      element = element.parentElement;
    }
    candidates.push(document.documentElement, document.body);

    const scrollRoot = candidates.find((candidate) => {
      const style = window.getComputedStyle(candidate);
      return (
        candidate.scrollHeight > candidate.clientHeight + 4 &&
        /(auto|scroll|overlay)/.test(style.overflowY)
      );
    });

    return scrollRoot?.scrollTop ?? window.scrollY;
  }, { editorSelector: EDITOR_SELECTOR });
}

function rgbChannels(color: string): [number, number, number] | null {
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/.exec(color);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

test.describe('notes html block caret parity', () => {
  test.setTimeout(120_000);

  test('keeps math and HTML block ArrowUp parity without saving extra blank lines', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-html-block-caret-parity');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const originalContent = [
          'Before math parity',
          '',
          '$$',
          'x',
          '$$',
          '',
          'After math parity',
          '',
          'Before html parity',
          '',
          '<p align="center">',
          '  <img src="https://raw.githubusercontent.com/521xueweihan/img_logo/master/logo/weixin.png" style="max-width: 30%"><br>',
          '关注「HelloGitHub」公众号，第一时间收到推送',
          '</p>',
          '',
          'After html parity',
        ].join('\n');
      const opened = await openMarkdownFixture(page, {
        filename: 'html-block-caret-parity-e2e.md',
        content: originalContent,
      });

      await expect(page.locator(`${EDITOR_SELECTOR} [data-type="math-block"]`)).toHaveCount(1);
      await expect(page.locator(REAL_HTML_BLOCK_SELECTOR, { hasText: 'HelloGitHub' })).toHaveCount(1);

      const mathHoverStyle = await captureHoverStyle(page, `${EDITOR_SELECTOR} [data-type="math-block"]`);
      expect(mathHoverStyle.cursor, { mathHoverStyle }).toBe('pointer');
      expect(mathHoverStyle.backgroundColor, { mathHoverStyle }).not.toBe('rgba(0, 0, 0, 0)');
      expect(mathHoverStyle.boxShadow, { mathHoverStyle }).not.toBe('none');
      const htmlHoverStyle = await captureHoverStyle(page, REAL_HTML_BLOCK_SELECTOR);
      expect(htmlHoverStyle.cursor, { htmlHoverStyle }).toBe('pointer');
      expect(htmlHoverStyle.backgroundColor, { htmlHoverStyle }).not.toBe('rgba(0, 0, 0, 0)');
      expect(htmlHoverStyle.boxShadow, { htmlHoverStyle }).not.toBe('none');
      expect(rgbChannels(htmlHoverStyle.backgroundColor), {
        mathHoverStyle,
        htmlHoverStyle,
      }).toEqual(rgbChannels(mathHoverStyle.backgroundColor));
      expect(htmlHoverStyle.boxShadow, {
        mathHoverStyle,
        htmlHoverStyle,
      }).toBe(mathHoverStyle.boxShadow);

      await clickParagraphText(page, 'After math parity');
      await page.keyboard.press('ArrowUp');
      const mathGapState = await captureCaretState(page);
      await page.keyboard.press('ArrowUp');
      const mathSelectedState = await captureCaretState(page);

      await clickParagraphText(page, 'After html parity');
      await page.keyboard.press('ArrowUp');
      const htmlGapState = await captureCaretState(page);
      await page.keyboard.press('ArrowUp');
      const htmlSelectedState = await captureCaretState(page);

      for (const state of [mathGapState, htmlGapState]) {
        expect(state.selectedNodes, {
          mathGapState,
          htmlGapState,
          htmlSelectedState,
        }).toEqual([]);
        expect(state.selection?.empty, {
          mathGapState,
          htmlGapState,
          htmlSelectedState,
        }).toBe(true);
        expect(state.domAnchor?.tagName, {
          mathGapState,
          htmlGapState,
          htmlSelectedState,
        }).toBe('P');
        expect(state.domAnchor?.closestBlockType, {
          mathGapState,
          htmlGapState,
          htmlSelectedState,
        }).toBe('');
      }

      expect(mathGapState.domAnchor?.previousSiblingType, {
        mathGapState,
        htmlGapState,
        htmlSelectedState,
      }).toBe('math-block');
      expect(mathGapState.domAnchor?.className, {
        mathGapState,
        htmlGapState,
        htmlSelectedState,
      }).toContain('editor-editable-markdown-blank-line');
      expect(htmlGapState.domAnchor?.previousSiblingType, {
        mathGapState,
        htmlGapState,
        htmlSelectedState,
      }).toBe('html-block');
      expect(htmlGapState.domAnchor?.className, {
        mathGapState,
        htmlGapState,
        htmlSelectedState,
      }).toContain('editor-editable-markdown-blank-line');

      for (const state of [mathSelectedState, htmlSelectedState]) {
        expect(state.selectedNodes, {
          mathSelectedState,
          htmlSelectedState,
        }).toEqual([]);
        expect(state.selection?.empty, {
          mathSelectedState,
          htmlSelectedState,
        }).toBe(true);
        expect(state.domAnchor?.tagName, {
          mathSelectedState,
          htmlSelectedState,
        }).toBe('P');
        expect(state.domAnchor?.closestBlockType, {
          mathSelectedState,
          htmlSelectedState,
        }).toBe('');
      }
      expect(mathSelectedState.domAnchor?.text, {
        mathSelectedState,
        htmlSelectedState,
      }).toBe('');
      expect(
        mathSelectedState.domAnchor?.className.includes('editor-editable-markdown-blank-line') ||
          mathSelectedState.domAnchor?.className.includes('editor-empty-paragraph'),
        { mathSelectedState, htmlSelectedState },
      ).toBe(true);
      expect(htmlSelectedState.domAnchor?.text, {
        mathSelectedState,
        htmlSelectedState,
      }).toBe('');
      expect(
        htmlSelectedState.domAnchor?.className.includes('editor-editable-markdown-blank-line') ||
          htmlSelectedState.domAnchor?.className.includes('editor-empty-paragraph'),
        { mathSelectedState, htmlSelectedState },
      ).toBe(true);

      for (let index = 0; index < 3; index += 1) {
        await clickParagraphText(page, 'After html parity');
        await page.keyboard.press('ArrowUp');
        await waitForEditorAnimationFrame(page);
      }

      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      const saved = await page.evaluate(
        (pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead),
        opened.notePath,
      );
      expect(saved).not.toContain('vlaina-markdown-blank-line');
      expect(saved).toContain([
        '<p align="center">',
        '  <img src="https://raw.githubusercontent.com/521xueweihan/img_logo/master/logo/weixin.png" style="max-width: 30%"><br>',
        '关注「HelloGitHub」公众号，第一时间收到推送',
        '</p>',
        '',
        'After html parity',
      ].join('\n'));
      expect(saved).not.toContain([
        '<p align="center">',
        '  <img src="https://raw.githubusercontent.com/521xueweihan/img_logo/master/logo/weixin.png" style="max-width: 30%"><br>',
        '关注「HelloGitHub」公众号，第一时间收到推送',
        '</p>',
        '',
        '',
        'After html parity',
      ].join('\n'));
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('scrolls a long HTML block popup into view after click-open', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-html-block-popup-scroll');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 620 });

      const longHtmlRows = Array.from({ length: 44 }, (_, index) =>
        `  <p>Long HTML preview row ${String(index + 1).padStart(2, '0')}</p>`
      );
      await openMarkdownFixture(page, {
        filename: 'html-block-popup-scroll-e2e.md',
        content: [
          'Before long html',
          '',
          '<div class="long-html-preview">',
          ...longHtmlRows,
          '</div>',
          '',
          'After long html',
        ].join('\n'),
      });

      const htmlBlock = page.locator(REAL_HTML_BLOCK_SELECTOR, { hasText: 'Long HTML preview row 01' }).first();
      await expect(htmlBlock).toBeVisible();
      await htmlBlock.evaluate((node) => node.scrollIntoView({ block: 'start', inline: 'nearest' }));
      await waitForEditorAnimationFrame(page);

      const beforeScrollTop = await captureEditorScrollTop(page);
      const blockBox = await htmlBlock.boundingBox();
      expect(blockBox, 'Expected long HTML block box').not.toBeNull();
      await page.mouse.click(blockBox!.x + 32, blockBox!.y + 24);
      await waitForEditorAnimationFrame(page);
      await waitForEditorAnimationFrame(page);

      const popup = page.locator('.html-block-editor-popup').first();
      await expect(popup).toBeVisible();
      const popupBox = await popup.boundingBox();
      expect(popupBox, 'Expected HTML popup box').not.toBeNull();
      const viewport = page.viewportSize();
      expect(viewport, 'Expected viewport size').not.toBeNull();
      const afterScrollTop = await captureEditorScrollTop(page);
      const textareaMetrics = await popup.locator('textarea.text-editor-textarea').evaluate((textarea) => {
        const element = textarea as HTMLTextAreaElement;
        const style = window.getComputedStyle(element);
        return {
          clientHeight: element.clientHeight,
          overflowY: style.overflowY,
          scrollHeight: element.scrollHeight,
        };
      });

      expect(afterScrollTop, { beforeScrollTop, afterScrollTop, popupBox, textareaMetrics }).toBeGreaterThan(beforeScrollTop);
      expect(popupBox!.y, { popupBox, viewport }).toBeGreaterThanOrEqual(0);
      expect(popupBox!.y, { popupBox, viewport }).toBeLessThan(viewport!.height);
      expect(textareaMetrics.overflowY, { textareaMetrics }).toBe('hidden');
      expect(textareaMetrics.clientHeight, { textareaMetrics }).toBeGreaterThanOrEqual(
        textareaMetrics.scrollHeight - 2
      );
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('creates and edits an HTML block cleanly from the /html slash command', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-html-block-slash-command');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 720 });

      const opened = await openMarkdownFixture(page, {
        filename: 'html-block-slash-command-e2e.md',
        content: 'hi',
      });

      const firstParagraph = page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'hi' }).first();
      await expect(firstParagraph).toBeVisible();
      await placeCaretAfterText(page, 'hi');
      await page.keyboard.press('Enter');
      await page.keyboard.type('/html');
      await expect(page.locator('.slash-menu')).toBeVisible();
      await expect(page.locator('.slash-menu-item.selected')).toContainText('HTML Block');
      await page.keyboard.press('Enter');
      await page.keyboard.type('<p>Slash HTML body</p>');
      await waitForEditorAnimationFrame(page);

      const textarea = page.locator('.html-block-editor-popup textarea.text-editor-textarea').first();
      await expect(textarea).toBeVisible();
      await expect(textarea).toBeFocused();
      await expect(textarea).toHaveValue('<p>Slash HTML body</p>');
      await expect(page.locator(REAL_HTML_BLOCK_SELECTOR, { hasText: 'Slash HTML body' })).toBeVisible();

      const editorText = await page.locator(EDITOR_SELECTOR).evaluate((editor) => editor.textContent ?? '');
      expect(editorText, { editorText }).toContain('hi');
      expect(editorText, { editorText }).toContain('Slash HTML body');
      expect(editorText, { editorText }).not.toContain('/html');
      expect(editorText, { editorText }).not.toContain('/hml');

      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
      await waitForEditorAnimationFrame(page);
      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      const saved = await page.evaluate(
        (pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead),
        opened.notePath,
      );
      expect(saved).toContain('hi');
      expect(saved).toContain('<p>Slash HTML body</p>');
      expect(saved).not.toContain('/html');
      expect(saved).not.toContain('/hml');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('creates an HTML block from a freshly typed middle blank line without hard-break backslashes', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-html-block-fresh-middle-blank');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 720 });

      const opened = await openMarkdownFixture(page, {
        filename: 'html-block-fresh-middle-blank-e2e.md',
        content: '',
      });

      await page.locator(EDITOR_SELECTOR).click();
      await page.keyboard.type('hi');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('1');
      await waitForEditorAnimationFrame(page);

      const hiParagraph = page.locator(`${EDITOR_SELECTOR} p`, { hasText: /^hi$/ }).first();
      const oneParagraph = page.locator(`${EDITOR_SELECTOR} p`, { hasText: /^1$/ }).first();
      await expect(hiParagraph).toBeVisible({ timeout: 30_000 });
      await expect(oneParagraph).toBeVisible({ timeout: 30_000 });
      const hiBox = await hiParagraph.boundingBox();
      const oneBox = await oneParagraph.boundingBox();
      expect(hiBox).not.toBeNull();
      expect(oneBox).not.toBeNull();

      await page.mouse.click(
        hiBox!.x + 4,
        Math.round((hiBox!.y + hiBox!.height + oneBox!.y) / 2),
      );
      await page.keyboard.type('/html');
      await expect(page.locator('.slash-menu-item.selected')).toContainText('HTML Block');
      await page.keyboard.press('Enter');
      await page.keyboard.type('<p>Fresh middle HTML body</p>');
      await waitForEditorAnimationFrame(page);

      const textarea = page.locator('.html-block-editor-popup textarea.text-editor-textarea').first();
      await expect(textarea).toBeVisible();
      await expect(textarea).toBeFocused();
      await expect(textarea).toHaveValue('<p>Fresh middle HTML body</p>');

      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
      await waitForEditorAnimationFrame(page);
      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      const saved = await page.evaluate(
        (pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead),
        opened.notePath,
      );
      expect(saved, { saved }).toBe(['hi', '', '<p>Fresh middle HTML body</p>', '', '1'].join('\n'));
      expect(saved, { saved }).not.toContain('hi\\');
      expect(saved, { saved }).not.toContain('/html');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps plain text entered in the HTML popup inside the HTML block', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-html-block-plain-text-popup');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 720 });

      const opened = await openMarkdownFixture(page, {
        filename: 'html-block-plain-text-popup-e2e.md',
        content: '',
      });

      await page.locator(EDITOR_SELECTOR).click();
      await page.keyboard.type('hi');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('1');
      await waitForEditorAnimationFrame(page);

      const hiParagraph = page.locator(`${EDITOR_SELECTOR} p`, { hasText: /^hi$/ }).first();
      const oneParagraph = page.locator(`${EDITOR_SELECTOR} p`, { hasText: /^1$/ }).first();
      await expect(hiParagraph).toBeVisible({ timeout: 30_000 });
      await expect(oneParagraph).toBeVisible({ timeout: 30_000 });
      const hiBox = await hiParagraph.boundingBox();
      const oneBox = await oneParagraph.boundingBox();
      expect(hiBox).not.toBeNull();
      expect(oneBox).not.toBeNull();

      await page.mouse.click(
        hiBox!.x + 4,
        Math.round((hiBox!.y + hiBox!.height + oneBox!.y) / 2),
      );
      await page.keyboard.type('/html');
      await expect(page.locator('.slash-menu-item.selected')).toContainText('HTML Block');
      await page.keyboard.press('Enter');
      await page.keyboard.type('h1');
      await waitForEditorAnimationFrame(page);

      const textarea = page.locator('.html-block-editor-popup textarea.text-editor-textarea').first();
      await expect(textarea).toBeVisible();
      await expect(textarea).toBeFocused();
      await expect(textarea).toHaveValue('h1');

      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
      await waitForEditorAnimationFrame(page);
      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      const saved = await page.evaluate(
        (pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead),
        opened.notePath,
      );
      expect(saved, { saved }).toBe(['hi', '', '<div>h1</div>', '', '1'].join('\n'));
      expect(saved, { saved }).not.toContain('h1\\');

      await page.evaluate((pathToOpen) => (window as any).__vlainaE2E.openAbsoluteNote(pathToOpen), opened.notePath);
      await expect(page.locator(REAL_HTML_BLOCK_SELECTOR, { hasText: 'h1' })).toBeVisible({ timeout: 30_000 });
      const reopenedText = await page.locator(EDITOR_SELECTOR).evaluate((editor) => editor.textContent ?? '');
      expect(reopenedText, { reopenedText }).toContain('hi');
      expect(reopenedText, { reopenedText }).toContain('h1');
      expect(reopenedText, { reopenedText }).toContain('1');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps focus in the HTML popup when /html is selected with the mouse', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-html-block-slash-mouse');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 720 });

      const opened = await openMarkdownFixture(page, {
        filename: 'html-block-slash-mouse-e2e.md',
        content: 'hi',
      });

      const firstParagraph = page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'hi' }).first();
      await expect(firstParagraph).toBeVisible();
      await placeCaretAfterText(page, 'hi');
      await page.keyboard.press('Enter');
      await page.keyboard.type('/html');

      const selectedItem = page.locator('.slash-menu-item.selected').first();
      await expect(selectedItem).toContainText('HTML Block');
      await selectedItem.click();
      await page.keyboard.type('<p>Mouse slash HTML body</p>');
      await waitForEditorAnimationFrame(page);

      const textarea = page.locator('.html-block-editor-popup textarea.text-editor-textarea').first();
      await expect(textarea).toBeVisible();
      await expect(textarea).toBeFocused();
      await expect(textarea).toHaveValue('<p>Mouse slash HTML body</p>');
      await expect(page.locator(REAL_HTML_BLOCK_SELECTOR, { hasText: 'Mouse slash HTML body' })).toBeVisible();

      const editorText = await page.locator(EDITOR_SELECTOR).evaluate((editor) => editor.textContent ?? '');
      expect(editorText, { editorText }).toContain('hi');
      expect(editorText, { editorText }).toContain('Mouse slash HTML body');
      expect(editorText, { editorText }).not.toContain('/html');
      expect(editorText, { editorText }).not.toContain('/hml');

      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
      await waitForEditorAnimationFrame(page);
      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      const saved = await page.evaluate(
        (pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead),
        opened.notePath,
      );
      expect(saved).toContain('hi');
      expect(saved).toContain('<p>Mouse slash HTML body</p>');
      expect(saved).not.toContain('/html');
      expect(saved).not.toContain('/hml');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
