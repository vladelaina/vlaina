import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

async function collectBackslashHardBreakState(page: Page) {
  return page.evaluate((editorSelector) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const paragraph = editor?.querySelector('p');
    const selection = (window as any).__vlainaE2E.getEditorSelectionSummary();
    const browserSelection = window.getSelection();
    const markedSlash = paragraph?.querySelector('[data-vlaina-backslash-hard-break-source-text="true"]');
    const markedSlashRect = markedSlash?.getBoundingClientRect();
    const paragraphRect = paragraph?.getBoundingClientRect();
    return {
      browserSelection: {
        anchorNodeName: browserSelection?.anchorNode
          ? (browserSelection.anchorNode.nodeType === Node.TEXT_NODE
            ? '#text'
            : (browserSelection.anchorNode as Element).nodeName)
          : null,
        anchorOffset: browserSelection?.anchorOffset ?? null,
        focusOffset: browserSelection?.focusOffset ?? null,
      },
      html: paragraph?.innerHTML ?? '',
      markedSlashRect: markedSlashRect
        ? {
          left: markedSlashRect.left,
          right: markedSlashRect.right,
          top: markedSlashRect.top,
          bottom: markedSlashRect.bottom,
        }
        : null,
      paragraphRect: paragraphRect
        ? {
          left: paragraphRect.left,
          right: paragraphRect.right,
          top: paragraphRect.top,
          bottom: paragraphRect.bottom,
        }
        : null,
      paragraphText: paragraph?.textContent ?? '',
      selection,
    };
  }, EDITOR_SELECTOR);
}

async function setSelectionAfterHardBreak(page: Page): Promise<{
  afterHardBreak: number;
  beforeFirstBackslash: number;
  betweenBackslashes: number;
}> {
  const beforeFirstBackslash = 2;
  const betweenBackslashes = 3;
  const afterHardBreak = 4;
  const selection = await page.evaluate(
    (position) => (window as any).__vlainaE2E.setEditorSelectionRange(position),
    afterHardBreak,
  );
  expect(selection).toMatchObject({
    empty: true,
    from: afterHardBreak,
    to: afterHardBreak,
  });
  return { afterHardBreak, beforeFirstBackslash, betweenBackslashes };
}

async function clickFirstLineEnd(page: Page) {
  const point = await page.evaluate((editorSelector) => {
    const paragraph = document.querySelector<HTMLElement>(`${editorSelector} p`);
    if (!paragraph) throw new Error('Missing target paragraph');
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const rects = Array.from(range.getClientRects());
    const firstLine = rects
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .sort((a, b) => a.top - b.top || b.right - a.right)[0];
    if (!firstLine) throw new Error('Missing first line rect');
    return {
      x: firstLine.right + 18,
      y: firstLine.top + firstLine.height / 2,
    };
  }, EDITOR_SELECTOR);
  await page.mouse.click(point.x, point.y);
  await waitForEditorAnimationFrame(page);
}

async function getBackslashLineEndDragPoints(page: Page, targetText: string) {
  return page.evaluate(({ editorSelector, targetText }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) throw new Error('Missing editor');

    const markedSlash = editor.querySelector<HTMLElement>('[data-vlaina-backslash-hard-break-source-text="true"]');
    if (!markedSlash) throw new Error('Missing visible backslash hard-break source');

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let textNode: Text | null = null;
    let targetIndex = -1;
    while (walker.nextNode()) {
      const candidate = walker.currentNode as Text;
      targetIndex = candidate.data.indexOf(targetText);
      if (targetIndex >= 0) {
        textNode = candidate;
        break;
      }
    }
    if (!textNode) throw new Error(`Missing target text: ${targetText}`);

    const targetRange = document.createRange();
    targetRange.setStart(textNode, targetIndex + targetText.length - 2);
    targetRange.setEnd(textNode, targetIndex + targetText.length - 1);
    const targetRect = targetRange.getBoundingClientRect();
    targetRange.detach();

    const slashRect = markedSlash.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const startX = Math.min(
      editorRect.right - 32,
      slashRect.right + 8,
    );
    const startY = slashRect.top + slashRect.height / 2;
    const endX = targetRect.right - Math.max(2, Math.min(6, targetRect.width / 2));
    const endY = targetRect.top + targetRect.height / 2;

    const startTarget = document.elementFromPoint(startX, startY);
    return {
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
      startTarget: startTarget instanceof HTMLElement
        ? {
          className: startTarget.className,
          tagName: startTarget.tagName,
          text: startTarget.textContent ?? '',
        }
        : null,
    };
  }, { editorSelector: EDITOR_SELECTOR, targetText });
}

test.describe('notes backslash hard break caret', () => {
  test.setTimeout(90_000);

  test('moves left from a visible backslash hard break line end to the space between slashes', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-backslash-hard-break-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await openMarkdownFixture(page, {
        filename: 'backslash-hard-break-caret.md',
        content: `。${'\\'.repeat(3)}\n下一行`,
      });

      await expect.poll(() => collectBackslashHardBreakState(page), { timeout: 10_000 }).toMatchObject({
        paragraphText: `。${'\\'.repeat(2)}下一行`,
      });

      const positions = await setSelectionAfterHardBreak(page);
      const beforeProgrammaticLeft = await collectBackslashHardBreakState(page);
      await page.keyboard.press('ArrowLeft');
      await waitForEditorAnimationFrame(page);
      const afterProgrammaticLeft = await collectBackslashHardBreakState(page);

      expect(afterProgrammaticLeft, {
        afterProgrammaticLeft,
        beforeProgrammaticLeft,
      }).toMatchObject({
        selection: {
          empty: true,
          from: positions.betweenBackslashes,
          to: positions.betweenBackslashes,
        },
      });

      await page.keyboard.press('ArrowLeft');
      await waitForEditorAnimationFrame(page);
      const afterSecondProgrammaticLeft = await collectBackslashHardBreakState(page);
      expect(afterSecondProgrammaticLeft.selection, {
        afterSecondProgrammaticLeft,
      }).toMatchObject({
        empty: true,
        from: positions.beforeFirstBackslash,
        to: positions.beforeFirstBackslash,
      });

      await clickFirstLineEnd(page);
      const clicked = await collectBackslashHardBreakState(page);
      await page.keyboard.press('ArrowLeft');
      await waitForEditorAnimationFrame(page);
      const afterClickLeft = await collectBackslashHardBreakState(page);

      expect(afterClickLeft.selection, {
        afterClickLeft,
        clicked,
      }).toMatchObject({
        empty: true,
        from: positions.betweenBackslashes,
        to: positions.betweenBackslashes,
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('allows mouse-drag text selection from a backslash hard-break line end', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-backslash-hard-break-drag-selection');
    const targetText = 'Next line selectable hard break drag target sentinel text.';

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await openMarkdownFixture(page, {
        filename: 'backslash-hard-break-drag-selection.md',
        content: [
          '# Backslash hard break drag selection',
          '',
          'Backslash selection starts here\\',
          targetText,
          '',
          'Trailing paragraph after selection.',
        ].join('\n'),
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText(targetText);

      const points = await getBackslashLineEndDragPoints(page, targetText);
      await page.mouse.move(points.start.x, points.start.y);
      await page.mouse.down();
      await page.mouse.move(points.end.x, points.end.y, { steps: 18 });
      await page.mouse.up();
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        return {
          nativeSelectedText: window.getSelection()?.toString() ?? '',
          selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
          hasPointerNativeClass: Boolean(editor?.classList.contains('editor-pointer-native-selection')),
        };
      }), {
        message: JSON.stringify(points),
      }).toMatchObject({
        selection: {
          empty: false,
          selectedText: expect.stringContaining('Next line selectable hard break drag target'),
        },
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
