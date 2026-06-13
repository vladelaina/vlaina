import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

const MARKDOWN_FONT_SIZE_STYLE_ID = 'vlaina-markdown-font-size-style';
const APPEARANCE_FONT_SIZE_SLIDER_SELECTOR = '[data-settings-control="appearance-font-size"]';

function createVeryLargePlainMarkdown(paragraphCount: number): {
  content: string;
  targetText: string;
} {
  const targetIndex = 0;
  const lines = ['# Large Markdown Interaction Performance', ''];
  let targetText = '';

  for (let index = 0; index < paragraphCount; index += 1) {
    const lead = `Large plain paragraph ${index} sentinel phrase for deep selection measurement`;
    if (index === targetIndex) {
      targetText = lead;
    }
    const filler = [
      'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau',
      'this line stays plain so the large markdown fast path can render a realistic long note',
      'the repeated prose gives the browser enough layout work to expose selection and font preview regressions',
    ].join(' ');
    lines.push(`${lead} ${filler} ${filler} ${filler}`);
    lines.push('');
  }

  lines.push('Final large markdown interaction performance sentinel');
  return {
    content: lines.join('\n'),
    targetText,
  };
}

async function scrollTextIntoView(page: Page, text: string): Promise<void> {
  await page.evaluate(({ editorSelector, text }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const scrollRoot = editor?.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
    if (!editor || !scrollRoot) {
      throw new Error('Editor or note scroll root not found');
    }
    const paragraph = Array.from(editor.querySelectorAll<HTMLElement>('p'))
      .find((candidate) => candidate.textContent?.includes(text));
    if (!paragraph) {
      throw new Error(`Paragraph not found for text: ${text}`);
    }

    const rootRect = scrollRoot.getBoundingClientRect();
    const paragraphRect = paragraph.getBoundingClientRect();
    scrollRoot.scrollTop += paragraphRect.top - rootRect.top - rootRect.height * 0.42;
  }, { editorSelector: EDITOR_SELECTOR, text });
  await waitForEditorAnimationFrame(page);
}

async function getTextDragPoints(page: Page, text: string): Promise<{
  start: { x: number; y: number };
  end: { x: number; y: number };
}> {
  return page.evaluate(({ editorSelector, text }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) {
      throw new Error('Editor not found');
    }

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let textNode: Text | null = null;
    let index = -1;
    while (walker.nextNode()) {
      const candidate = walker.currentNode as Text;
      index = candidate.data.indexOf(text);
      if (index >= 0) {
        textNode = candidate;
        break;
      }
    }
    if (!textNode) {
      throw new Error(`Text not found: ${text}`);
    }

    const startRange = document.createRange();
    startRange.setStart(textNode, index);
    startRange.setEnd(textNode, index + 1);
    const startRect = startRange.getBoundingClientRect();

    const endRange = document.createRange();
    endRange.setStart(textNode, index + text.length - 2);
    endRange.setEnd(textNode, index + text.length - 1);
    const endRect = endRange.getBoundingClientRect();

    startRange.detach();
    endRange.detach();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isVisible =
      startRect.width > 0 &&
      startRect.height > 0 &&
      endRect.width > 0 &&
      endRect.height > 0 &&
      startRect.top >= 0 &&
      startRect.bottom <= viewportHeight &&
      endRect.top >= 0 &&
      endRect.bottom <= viewportHeight &&
      startRect.left >= 0 &&
      startRect.right <= viewportWidth &&
      endRect.left >= 0 &&
      endRect.right <= viewportWidth;

    if (!isVisible) {
      throw new Error(`Text is not visible enough for drag selection: ${text}`);
    }

    return {
      start: {
        x: startRect.left + Math.max(2, Math.min(6, startRect.width / 2)),
        y: startRect.top + startRect.height / 2,
      },
      end: {
        x: endRect.right - Math.max(2, Math.min(6, endRect.width / 2)),
        y: endRect.top + endRect.height / 2,
      },
    };
  }, { editorSelector: EDITOR_SELECTOR, text });
}

async function collectFrameMetrics(page: Page, durationMs: number): Promise<{
  frameCount: number;
  maxFrameMs: number;
  styleMutationCount: number;
}> {
  return page.evaluate(({ durationMs, styleId }) => new Promise<{
    frameCount: number;
    maxFrameMs: number;
    styleMutationCount: number;
  }>((resolve) => {
    let frameCount = 0;
    let maxFrameMs = 0;
    let styleMutationCount = 0;
    const startedAt = performance.now();
    let lastFrameAt = startedAt;
    const observer = new MutationObserver((mutations) => {
      styleMutationCount += mutations.filter((mutation) => {
        const target = mutation.target;
        if (target instanceof HTMLElement) {
          return target.id === styleId || target.closest(`#${styleId}`);
        }
        return target.parentElement?.id === styleId;
      }).length;
    });
    observer.observe(document.head, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    const collect = () => {
      const now = performance.now();
      frameCount += 1;
      maxFrameMs = Math.max(maxFrameMs, now - lastFrameAt);
      lastFrameAt = now;
      if (now - startedAt >= durationMs) {
        observer.disconnect();
        resolve({
          frameCount,
          maxFrameMs: Math.round(maxFrameMs * 10) / 10,
          styleMutationCount,
        });
        return;
      }
      requestAnimationFrame(collect);
    };

    requestAnimationFrame(collect);
  }), { durationMs, styleId: MARKDOWN_FONT_SIZE_STYLE_ID });
}

async function measurePointerNativeSelectionTransaction(page: Page, text: string): Promise<{
  frameCount: number;
  maxFrameMs: number;
  selectionTransactionMs: number;
  pointerStartMs: number;
  pointerStartSource: 'mouse' | 'synthetic';
  duringPointerOverlayCount: number;
  finalOverlayCount: number;
  finalPointerNative: boolean;
  selectedTextLength: number;
  pointerNativeDuringSelection: boolean;
  selectTimings?: Record<string, number>;
}> {
  await scrollTextIntoView(page, text);
  const points = await getTextDragPoints(page, text);
  const framesPromise = collectFrameMetrics(page, 900);
  const startedAt = Date.now();
  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down();
  let pointerStart = await page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    return {
      pointerNative: Boolean(editor?.classList.contains('editor-pointer-native-selection')),
    };
  });
  let pointerStartSource: 'mouse' | 'synthetic' = 'mouse';

  if (!pointerStart.pointerNative) {
    pointerStartSource = 'synthetic';
    pointerStart = await page.evaluate(({ editorSelector, point }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) {
      throw new Error('Editor not found');
    }
    const target = document.elementFromPoint(point.x, point.y) ?? editor;
    target.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
      view: window,
    }));
    return {
      targetName: target instanceof HTMLElement ? target.tagName.toLowerCase() : target.nodeName,
      pointerNative: editor.classList.contains('editor-pointer-native-selection'),
    };
    }, { editorSelector: EDITOR_SELECTOR, point: points.start });
  }
  const pointerStartMs = Date.now() - startedAt;
  const selected = await page.evaluate((targetText) =>
    (window as any).__vlainaE2E.selectEditorTextByText(targetText), text);
  const selectionTransactionMs = Date.now() - startedAt;
  const duringPointerState = await page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    return {
      overlayCount: document.querySelectorAll('.editor-text-selection-overlay').length,
      pointerNative: Boolean(editor?.classList.contains('editor-pointer-native-selection')),
    };
  });
  const frames = await framesPromise;
  if (pointerStartSource === 'mouse') {
    await page.mouse.up();
  } else {
    await page.evaluate(() => {
      document.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        button: 0,
        cancelable: true,
        view: window,
      }));
    });
  }
  await waitForEditorAnimationFrame(page);
  await waitForEditorAnimationFrame(page);
  const finalState = await page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    const summary = (window as any).__vlainaE2E.getEditorSelectionSummary();
    return {
      overlayCount: document.querySelectorAll('.editor-text-selection-overlay').length,
      pointerNative: Boolean(editor?.classList.contains('editor-pointer-native-selection')),
      selectedTextLength: summary?.selectedText?.length ?? 0,
    };
  });
  return {
    ...frames,
    selectionTransactionMs,
    pointerStartMs,
    pointerStartSource,
    duringPointerOverlayCount: duringPointerState.overlayCount,
    finalOverlayCount: finalState.overlayCount,
    finalPointerNative: finalState.pointerNative,
    selectedTextLength: selected.selectedText?.length ?? finalState.selectedTextLength,
    pointerNativeDuringSelection: pointerStart.pointerNative && duringPointerState.pointerNative,
    selectTimings: selected.timings,
  };
}

async function openAppearanceSettings(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('open-settings'));
  });
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'appearance' } }));
  });
  await expect(page.locator(APPEARANCE_FONT_SIZE_SLIDER_SELECTOR).first()).toBeVisible({ timeout: 10_000 });
}

async function measureFontSizeSliderDrag(page: Page): Promise<{
  frameCount: number;
  maxFrameMs: number;
  sliderGestureMs: number;
  styleMutationCount: number;
  fontSize: number;
  sliderValue: number;
}> {
  await openAppearanceSettings(page);
  const slider = page.locator(APPEARANCE_FONT_SIZE_SLIDER_SELECTOR).first();
  const box = await slider.boundingBox();
  if (!box) {
    throw new Error('Font size slider box not found');
  }

  const framesPromise = collectFrameMetrics(page, 1_400);
  const startedAt = Date.now();
  await page.mouse.move(box.x + box.width * 0.16, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, { steps: 44 });
  await page.mouse.up();
  const sliderGestureMs = Date.now() - startedAt;
  const frames = await framesPromise;
  const uiState = await page.evaluate(() => (window as any).__vlainaE2E.getUIState());
  const sliderValue = Number(await slider.inputValue());

  return {
    ...frames,
    sliderGestureMs,
    fontSize: uiState.fontSize,
    sliderValue,
  };
}

test.describe('large markdown interaction performance', () => {
  test.setTimeout(180_000);

  test('keeps text selection and appearance font-size preview responsive in a very large note', async () => {
    const { content, targetText } = createVeryLargePlainMarkdown(1_700);
    const { app, userDataRoot } = await launchIsolatedElectron('notes-large-markdown-interaction-performance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const opened = await openMarkdownFixture(page, {
        filename: 'large-markdown-interaction-performance.md',
        content,
      });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Final large markdown interaction performance sentinel');

      const selectionMetrics = await measurePointerNativeSelectionTransaction(page, targetText);
      const sliderMetrics = await measureFontSizeSliderDrag(page);

      console.info('[notes-large-markdown-interaction-performance]', {
        contentLength: content.length,
        opened,
        selectionMetrics,
        sliderMetrics,
      });

      expect(content.length).toBeGreaterThan(1_000_000);
      expect(opened.storeOpenMs).toBeLessThan(30_000);
      expect(selectionMetrics.selectedTextLength).toBeGreaterThan(40);
      expect(selectionMetrics.selectionTransactionMs).toBeLessThan(2_500);
      expect(selectionMetrics.maxFrameMs).toBeLessThan(450);
      expect(selectionMetrics.pointerNativeDuringSelection).toBe(true);
      expect(selectionMetrics.duringPointerOverlayCount).toBe(0);
      expect(selectionMetrics.finalOverlayCount).toBe(0);
      expect(selectionMetrics.finalPointerNative).toBe(true);
      expect(sliderMetrics.sliderValue).toBeGreaterThan(17);
      expect(sliderMetrics.fontSize).toBeGreaterThan(17);
      expect(sliderMetrics.sliderGestureMs).toBeLessThan(2_500);
      expect(sliderMetrics.maxFrameMs).toBeLessThan(450);
      expect(sliderMetrics.styleMutationCount).toBeLessThanOrEqual(4);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
