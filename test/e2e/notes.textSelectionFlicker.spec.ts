import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  FILE_TREE_PRIMARY_SELECTOR,
  NOTE_SCROLL_ROOT_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

const TARGET_TEXT =
  'Ordinary selectable paragraph alpha sentinel for mouse drag selection stability across frames.';

type SelectionFrame = {
  nativeSelectedText: string;
  selectedText: string;
  overlayCount: number;
  hasOverlayActiveClass: boolean;
  hasPointerNativeClass: boolean;
  toolbarVisible: boolean;
};

type ScreenshotClip = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SelectionBluePixelMetrics = {
  bluePixelBoundsHeight: number;
  bluePixelBoundsWidth: number;
  bluePixelCount: number;
  height: number;
  totalPixels: number;
  width: number;
};

type ToolbarPositionFrame = {
  rectTop: number;
  rectBottom: number;
  scrollTop: number;
  styleTop: string;
  visible: boolean;
};

async function getTextDragPoints(page: Page, text: string) {
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

async function getTagEdgeDragPoints(page: Page, tagText: string, targetText: string) {
  return page.evaluate(({ editorSelector, tagText, targetText }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) throw new Error('Editor not found');

    const tag = Array.from(editor.querySelectorAll<HTMLElement>('[data-editor-tag-token="true"]'))
      .find((candidate) => candidate.textContent === tagText);
    if (!tag) throw new Error(`Tag token not found: ${tagText}`);

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let textNode: Text | null = null;
    let index = -1;
    while (walker.nextNode()) {
      const candidate = walker.currentNode as Text;
      index = candidate.data.indexOf(targetText);
      if (index >= 0) {
        textNode = candidate;
        break;
      }
    }
    if (!textNode) throw new Error(`Target text not found: ${targetText}`);

    const endRange = document.createRange();
    endRange.setStart(textNode, index + targetText.length - 2);
    endRange.setEnd(textNode, index + targetText.length - 1);
    const endRect = endRange.getBoundingClientRect();
    endRange.detach();

    const tagRect = tag.getBoundingClientRect();
    return {
      start: {
        x: tagRect.right - Math.max(2, Math.min(5, tagRect.width * 0.08)),
        y: tagRect.top + tagRect.height / 2,
      },
      end: {
        x: endRect.right - Math.max(2, Math.min(6, endRect.width / 2)),
        y: endRect.top + endRect.height / 2,
      },
    };
  }, { editorSelector: EDITOR_SELECTOR, tagText, targetText });
}

async function getTextRangeScreenshotClip(page: Page, text: string): Promise<ScreenshotClip> {
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

    const range = document.createRange();
    range.setStart(textNode, index);
    range.setEnd(textNode, index + text.length);
    const rects = Array.from(range.getClientRects())
      .filter((rect) => rect.width > 2 && rect.height > 2);
    range.detach();

    if (rects.length === 0) {
      throw new Error(`Text has no screenshotable rects: ${text}`);
    }

    const padding = 3;
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    const x = Math.max(0, Math.floor(left - padding));
    const y = Math.max(0, Math.floor(top - padding));
    const clippedRight = Math.min(window.innerWidth, Math.ceil(right + padding));
    const clippedBottom = Math.min(window.innerHeight, Math.ceil(bottom + padding));

    return {
      x,
      y,
      width: Math.max(1, clippedRight - x),
      height: Math.max(1, clippedBottom - y),
    };
  }, { editorSelector: EDITOR_SELECTOR, text });
}

async function getTextOffsetClickPoint(
  page: Page,
  text: string,
  offset: number,
): Promise<{
  x: number;
  y: number;
}> {
  return page.evaluate(({ editorSelector, offset, text }) => {
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

    const charOffset = Math.max(0, Math.min(text.length - 1, offset));
    const range = document.createRange();
    range.setStart(textNode, index + charOffset);
    range.setEnd(textNode, index + charOffset + 1);
    const rect = range.getBoundingClientRect();
    range.detach();

    if (rect.width <= 0 || rect.height <= 0) {
      throw new Error(`Text offset is not clickable: ${text} @ ${offset}`);
    }

    return {
      x: rect.left + rect.width * 0.65,
      y: rect.top + rect.height / 2,
    };
  }, { editorSelector: EDITOR_SELECTOR, offset, text });
}

async function getNativeSelectionOffsetForText(
  page: Page,
  text: string,
): Promise<{
  anchorOffsetInText: number | null;
  isCollapsed: boolean | null;
  selectedText: string;
}> {
  return page.evaluate(({ editorSelector, text }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const nativeSelection = window.getSelection();
    if (!editor || !nativeSelection) {
      return {
        anchorOffsetInText: null,
        isCollapsed: null,
        selectedText: '',
      };
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

    return {
      anchorOffsetInText: textNode && nativeSelection.anchorNode === textNode
        ? nativeSelection.anchorOffset - index
        : null,
      isCollapsed: nativeSelection.isCollapsed,
      selectedText: nativeSelection.toString(),
    };
  }, { editorSelector: EDITOR_SELECTOR, text });
}

async function countSelectionBluePixelsInClip(
  page: Page,
  clip: ScreenshotClip
): Promise<SelectionBluePixelMetrics> {
  const screenshot = await page.screenshot({ clip });
  const dataUrl = `data:image/png;base64,${screenshot.toString('base64')}`;

  return page.evaluate(async (imageUrl) => {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to load selection screenshot'));
      image.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Could not create canvas context for selection screenshot');
    }

    context.drawImage(image, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    let bluePixelCount = 0;
    let minBlueX = Number.POSITIVE_INFINITY;
    let minBlueY = Number.POSITIVE_INFINITY;
    let maxBlueX = Number.NEGATIVE_INFINITY;
    let maxBlueY = Number.NEGATIVE_INFINITY;
    for (let offset = 0; offset < data.length; offset += 4) {
      const red = data[offset] ?? 0;
      const green = data[offset + 1] ?? 0;
      const blue = data[offset + 2] ?? 0;
      const alpha = data[offset + 3] ?? 0;
      const isSelectionBlue =
        alpha > 220 &&
        red < 100 &&
        green >= 70 &&
        green <= 180 &&
        blue >= 140 &&
        blue - red > 70 &&
        blue - green > 25;

      if (isSelectionBlue) {
        bluePixelCount += 1;
        const pixelIndex = offset / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        minBlueX = Math.min(minBlueX, x);
        minBlueY = Math.min(minBlueY, y);
        maxBlueX = Math.max(maxBlueX, x);
        maxBlueY = Math.max(maxBlueY, y);
      }
    }
    const hasBluePixels = bluePixelCount > 0;

    return {
      bluePixelBoundsHeight: hasBluePixels ? maxBlueY - minBlueY + 1 : 0,
      bluePixelBoundsWidth: hasBluePixels ? maxBlueX - minBlueX + 1 : 0,
      bluePixelCount,
      height,
      totalPixels: width * height,
      width,
    };
  }, dataUrl);
}

async function scrollParagraphTextIntoSelectionView(page: Page, text: string): Promise<void> {
  await page.evaluate(({ editorSelector, text }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const scrollRoot = editor?.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
    const paragraph = Array.from(document.querySelectorAll<HTMLElement>(`${editorSelector} p`))
      .find((candidate) => candidate.textContent?.includes(text));
    if (!scrollRoot || !paragraph) {
      return;
    }

    const rootRect = scrollRoot.getBoundingClientRect();
    const paragraphRect = paragraph.getBoundingClientRect();
    scrollRoot.scrollTop += paragraphRect.top - rootRect.top - rootRect.height * 0.35;
  }, { editorSelector: EDITOR_SELECTOR, text });
  await waitForEditorAnimationFrame(page);
}

async function selectTextByMouseDrag(page: Page, text: string): Promise<void> {
  await scrollParagraphTextIntoSelectionView(page, text);
  const points = await getTextDragPoints(page, text);
  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down();
  await page.mouse.move(points.end.x, points.end.y, { steps: 24 });
  await page.mouse.up();
  await waitForEditorAnimationFrame(page);
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__vlainaE2E.getEditorSelectionSummary()
  )).toMatchObject({
    empty: false,
    selectedText: expect.stringContaining('Ordinary selectable paragraph alpha sentinel'),
  });
}

async function getVisibleToolbarActionCenter(
  page: Page,
  action: string,
): Promise<{
  x: number;
  y: number;
}> {
  return page.evaluate((targetAction) => {
    const toolbar = document.querySelector<HTMLElement>('.floating-toolbar.visible');
    const actionElement = toolbar?.querySelector<HTMLElement>(`[data-action="${targetAction}"]`);
    const target = actionElement ?? toolbar;
    if (!target) {
      throw new Error(`Visible toolbar action not found: ${targetAction}`);
    }

    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      throw new Error(`Visible toolbar action has no rect: ${targetAction}`);
    }

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, action);
}

async function collectToolbarPositionFrames(page: Page, durationMs: number): Promise<ToolbarPositionFrame[]> {
  return page.evaluate((sampleDurationMs) => new Promise<ToolbarPositionFrame[]>((resolve) => {
    const frames: ToolbarPositionFrame[] = [];
    const startedAt = performance.now();

    const collect = () => {
      const toolbar = document.querySelector<HTMLElement>('.floating-toolbar');
      const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
      const scrollRoot = editor?.closest<HTMLElement>('[data-note-scroll-root="true"]') ?? null;
      const rect = toolbar?.getBoundingClientRect();
      frames.push({
        rectTop: rect ? Math.round(rect.top * 10) / 10 : Number.NaN,
        rectBottom: rect ? Math.round(rect.bottom * 10) / 10 : Number.NaN,
        scrollTop: scrollRoot ? Math.round(scrollRoot.scrollTop * 10) / 10 : Number.NaN,
        styleTop: toolbar?.style.top ?? '',
        visible: Boolean(toolbar?.classList.contains('visible')),
      });

      if (performance.now() - startedAt >= sampleDurationMs) {
        resolve(frames);
        return;
      }

      requestAnimationFrame(collect);
    };

    requestAnimationFrame(collect);
  }), durationMs);
}

function getToolbarTopJump(frames: ToolbarPositionFrame[]): number {
  const tops = frames
    .filter((frame) => frame.visible && Number.isFinite(frame.rectTop))
    .map((frame) => frame.rectTop);
  if (tops.length === 0) {
    return 0;
  }

  return Math.max(...tops) - Math.min(...tops);
}

function createScrollableSelectionToolbarMarkdown(): {
  content: string;
  target: string;
} {
  const target = 'Scrollable toolbar hover target sentinel text stays selected while the note is repositioned.';
  const paragraphs = ['# Toolbar Hover Scroll Stability', ''];

  for (let index = 0; index < 35; index += 1) {
    paragraphs.push(`Prelude paragraph ${index} adds enough height before the target selection for a real note scroll.`);
    paragraphs.push('');
  }

  paragraphs.push(`${target} Additional words keep the selected line wide enough for stable toolbar placement.`);
  paragraphs.push('');

  for (let index = 0; index < 45; index += 1) {
    paragraphs.push(`Trailing paragraph ${index} keeps the note scrollable after the target selection.`);
    paragraphs.push('');
  }

  return {
    content: paragraphs.join('\n'),
    target,
  };
}

async function getNoteBodyBlankClickPoint(
  page: Page,
  text: string,
  kind: 'right-text-gap' | 'left-text-gap' | 'below-last-block',
): Promise<{
  name: string;
  target: string;
  x: number;
  y: number;
}> {
  return page.evaluate(({ editorSelector, scrollRootSelector, text, kind }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const scrollRoot = document.querySelector<HTMLElement>(scrollRootSelector);
    if (!editor || !scrollRoot) {
      throw new Error('Editor or scroll root not found');
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

    const textRange = document.createRange();
    textRange.setStart(textNode, index);
    textRange.setEnd(textNode, index + text.length);
    const textRect = textRange.getBoundingClientRect();
    textRange.detach();

    const editorRect = editor.getBoundingClientRect();
    const scrollRect = scrollRoot.getBoundingClientRect();
    const lastBlock = Array.from(editor.children).at(-1) as HTMLElement | undefined;
    const lastBlockRect = lastBlock?.getBoundingClientRect() ?? textRect;
    const centerY = textRect.top + textRect.height / 2;

    const candidates = {
      'right-text-gap': {
        x: Math.min(editorRect.right - 18, Math.max(textRect.right + 72, editorRect.left + editorRect.width * 0.72)),
        y: centerY,
      },
      'left-text-gap': {
        x: Math.max(editorRect.left + 18, Math.min(textRect.left - 56, editorRect.left + editorRect.width * 0.18)),
        y: centerY,
      },
      'below-last-block': {
        x: Math.min(editorRect.right - 40, Math.max(editorRect.left + 120, editorRect.left + editorRect.width * 0.5)),
        y: Math.min(scrollRect.bottom - 32, Math.max(lastBlockRect.bottom + 52, textRect.bottom + 96)),
      },
    } satisfies Record<typeof kind, { x: number; y: number }>;

    const point = candidates[kind];
    const x = Math.max(scrollRect.left + 8, Math.min(scrollRect.right - 8, point.x));
    const y = Math.max(scrollRect.top + 8, Math.min(scrollRect.bottom - 8, point.y));
    const target = document.elementFromPoint(x, y);
    const toolbar = document.querySelector<HTMLElement>('.floating-toolbar.visible');
    const toolbarRect = toolbar?.getBoundingClientRect();
    if (
      toolbarRect &&
      x >= toolbarRect.left &&
      x <= toolbarRect.right &&
      y >= toolbarRect.top &&
      y <= toolbarRect.bottom
    ) {
      throw new Error(`Blank click point ${kind} overlaps the floating toolbar`);
    }

    return {
      name: kind,
      target: target
        ? [
            target instanceof HTMLElement ? target.tagName.toLowerCase() : target.nodeName,
            target instanceof HTMLElement ? target.className : '',
          ].join('.')
        : 'none',
      x,
      y,
    };
  }, { editorSelector: EDITOR_SELECTOR, scrollRootSelector: NOTE_SCROLL_ROOT_SELECTOR, text, kind });
}

async function collectSelectionFrames(page: Page, durationMs: number): Promise<SelectionFrame[]> {
  return page.evaluate(({ durationMs }) => new Promise<SelectionFrame[]>((resolve) => {
    const frames: SelectionFrame[] = [];
    const startedAt = performance.now();

    const collect = () => {
      const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
      const toolbar = document.querySelector<HTMLElement>('.floating-toolbar');
      const selection = (window as any).__vlainaE2E.getEditorSelectionSummary();
      frames.push({
        nativeSelectedText: window.getSelection()?.toString() ?? '',
        selectedText: selection?.selectedText ?? '',
        overlayCount: document.querySelectorAll('.editor-text-selection-overlay').length,
        hasOverlayActiveClass: Boolean(editor?.classList.contains('editor-text-selection-overlay-active')),
        hasPointerNativeClass: Boolean(editor?.classList.contains('editor-pointer-native-selection')),
        toolbarVisible: Boolean(toolbar?.classList.contains('visible')),
      });

      if (performance.now() - startedAt >= durationMs) {
        resolve(frames);
        return;
      }

      requestAnimationFrame(collect);
    };

    requestAnimationFrame(collect);
  }), { durationMs });
}

function countBooleanTransitions(frames: SelectionFrame[], key: keyof SelectionFrame): number {
  let transitions = 0;
  for (let index = 1; index < frames.length; index += 1) {
    if (Boolean(frames[index]?.[key]) !== Boolean(frames[index - 1]?.[key])) {
      transitions += 1;
    }
  }
  return transitions;
}

async function clickOutsideEditorAndToolbar(page: Page): Promise<void> {
  const point = await page.evaluate(({ editorSelector, outsideSelector }) => {
    const outside = document.querySelector<HTMLElement>(outsideSelector);
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const toolbar = document.querySelector<HTMLElement>('.floating-toolbar.visible');
    const outsideRect = outside?.getBoundingClientRect();

    if (outsideRect && outsideRect.width > 20 && outsideRect.height > 20) {
      const x = outsideRect.left + Math.min(20, outsideRect.width / 2);
      const y = outsideRect.top + Math.min(20, outsideRect.height / 2);
      return { x, y };
    }

    const editorRect = editor?.getBoundingClientRect();
    const toolbarRect = toolbar?.getBoundingClientRect();
    const candidates = [
      { x: 12, y: 12 },
      { x: window.innerWidth - 12, y: 12 },
      { x: 12, y: window.innerHeight - 12 },
      { x: window.innerWidth - 12, y: window.innerHeight - 12 },
    ];

    return candidates.find((candidate) => {
      const inEditor = editorRect
        ? candidate.x >= editorRect.left &&
          candidate.x <= editorRect.right &&
          candidate.y >= editorRect.top &&
          candidate.y <= editorRect.bottom
        : false;
      const inToolbar = toolbarRect
        ? candidate.x >= toolbarRect.left &&
          candidate.x <= toolbarRect.right &&
          candidate.y >= toolbarRect.top &&
          candidate.y <= toolbarRect.bottom
        : false;
      return !inEditor && !inToolbar;
    }) ?? { x: 12, y: 12 };
  }, { editorSelector: EDITOR_SELECTOR, outsideSelector: FILE_TREE_PRIMARY_SELECTOR });

  await page.mouse.click(point.x, point.y);
  await waitForEditorAnimationFrame(page);
}

function createLargeTextSelectionMarkdown(paragraphCount: number): {
  content: string;
  targets: string[];
} {
  const paragraphs: string[] = ['# Text Selection Performance', ''];
  const targets: string[] = [];

  for (let index = 0; index < paragraphCount; index += 1) {
    const target = `Selection performance paragraph ${index} sentinel phrase`;
    targets.push(target);
    paragraphs.push([
      `${target} begins this ordinary prose line for repeatable text-selection measurement.`,
      `Additional filler ${index} keeps this paragraph long enough to wrap across the editor line box while still staying in a single text node for coordinate measurement.`,
      `Trailing plain words ${index} alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.`,
    ].join(' '));
    paragraphs.push('');
  }

  paragraphs.push('Final text selection performance sentinel.');
  return {
    content: paragraphs.join('\n'),
    targets,
  };
}

async function measureRepeatedEditorTextSelection(page: Page, targets: string[]) {
  const samples: Array<{
    durationMs: number;
    overlayCount: number;
    selectedTextLength: number;
    targetLength: number;
  }> = [];
  let maxFrameMs = 0;

  for (const target of targets) {
    await scrollParagraphTextIntoSelectionView(page, target);
    const frameMetrics = await page.evaluate((targetText) => new Promise<{
      durationMs: number;
      maxFrameMs: number;
      overlayCount: number;
      selectedTextLength: number;
    }>(async (resolve) => {
      const startedAt = performance.now();
      await (window as any).__vlainaE2E.selectEditorTextByText(targetText);
      let frames = 0;
      let lastFrameAt = performance.now();
      let maxDelta = 0;

      const collect = () => {
        const now = performance.now();
        maxDelta = Math.max(maxDelta, now - lastFrameAt);
        lastFrameAt = now;
        frames += 1;

        if (frames < 4) {
          requestAnimationFrame(collect);
          return;
        }

        const summary = (window as any).__vlainaE2E.getEditorSelectionSummary();
        resolve({
          durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
          maxFrameMs: Math.round(maxDelta * 10) / 10,
          overlayCount: document.querySelectorAll('.editor-text-selection-overlay').length,
          selectedTextLength: summary?.selectedText?.length ?? 0,
        });
      };

      requestAnimationFrame(collect);
    }), target);

    maxFrameMs = Math.max(maxFrameMs, frameMetrics.maxFrameMs);
    samples.push({
      durationMs: frameMetrics.durationMs,
      overlayCount: frameMetrics.overlayCount,
      selectedTextLength: frameMetrics.selectedTextLength,
      targetLength: target.length,
    });
  }

  const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
  const pick = (ratio: number) =>
    durations[Math.min(durations.length - 1, Math.max(0, Math.ceil(durations.length * ratio) - 1))] ?? 0;
  const avg = durations.reduce((sum, value) => sum + value, 0) / Math.max(1, durations.length);

  return {
    samples,
    avgMs: Math.round(avg * 10) / 10,
    p95Ms: Math.round(pick(0.95) * 10) / 10,
    maxMs: Math.max(...durations),
    maxFrameMs,
    maxOverlayCount: Math.max(...samples.map((sample) => sample.overlayCount)),
    minSelectedTextLength: Math.min(...samples.map((sample) => sample.selectedTextLength)),
  };
}

test.describe('notes text selection stability', () => {
  test.setTimeout(120_000);

  test('keeps ordinary mouse-drag text selection visible without flicker', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-text-selection-flicker');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await openMarkdownFixture(page, {
        filename: 'text-selection-flicker.md',
        content: [
          '# Text Selection Flicker',
          '',
          TARGET_TEXT,
          '',
          'Ordinary selectable paragraph beta sentinel for selection follow-up.',
        ].join('\n'),
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText(TARGET_TEXT);

      const points = await getTextDragPoints(page, TARGET_TEXT);
      let duringDragFrames: SelectionFrame[] = [];
      let duringDragBluePixels: SelectionBluePixelMetrics | null = null;
      let settledBluePixels: SelectionBluePixelMetrics | null = null;
      let selectedTextClip: ScreenshotClip | null = null;
      let mouseIsDown = false;
      await page.mouse.move(points.start.x, points.start.y);
      await page.mouse.down();
      mouseIsDown = true;
      try {
        await page.mouse.move(points.end.x, points.end.y, { steps: 24 });
        await waitForEditorAnimationFrame(page);
        selectedTextClip = await getTextRangeScreenshotClip(page, TARGET_TEXT);
        duringDragBluePixels = await countSelectionBluePixelsInClip(page, selectedTextClip);
        duringDragFrames = await collectSelectionFrames(page, 250);
      } finally {
        if (mouseIsDown) {
          await page.mouse.up();
          mouseIsDown = false;
        }
      }
      const settledFrames = await collectSelectionFrames(page, 500);
      if (!selectedTextClip) {
        throw new Error('Missing text selection screenshot clip');
      }
      settledBluePixels = await countSelectionBluePixelsInClip(page, selectedTextClip);

      const duringDragHasVisibleSelection = duringDragFrames.some((frame) =>
        frame.nativeSelectedText.length > 0 ||
        frame.selectedText.length > 0 ||
        frame.overlayCount > 0 ||
        frame.hasPointerNativeClass
      );
      const settledNonEmptyFrames = settledFrames.filter((frame) =>
        frame.selectedText.length > 0 || frame.nativeSelectedText.length > 0 || frame.overlayCount > 0
      );
      const settledPointerNativeFrames = settledFrames.filter((frame) => frame.hasPointerNativeClass);
      const settledOverlayFrames = settledFrames.filter((frame) => frame.overlayCount > 0);

      expect(duringDragHasVisibleSelection).toBe(true);
      expect(duringDragBluePixels?.bluePixelCount ?? 0).toBeGreaterThan(80);
      expect(settledBluePixels?.bluePixelCount ?? 0).toBeGreaterThan(80);
      expect(settledBluePixels?.bluePixelBoundsHeight ?? 0).toBeGreaterThanOrEqual(
        Math.floor((duringDragBluePixels?.bluePixelBoundsHeight ?? 0) * 0.9)
      );
      expect(settledNonEmptyFrames.length).toBeGreaterThan(Math.floor(settledFrames.length * 0.8));
      expect(settledPointerNativeFrames.length).toBeGreaterThan(Math.floor(settledFrames.length * 0.8));
      expect(settledOverlayFrames).toHaveLength(0);
      expect(countBooleanTransitions(settledFrames, 'hasOverlayActiveClass')).toBeLessThanOrEqual(1);
      expect(countBooleanTransitions(settledFrames, 'toolbarVisible')).toBeLessThanOrEqual(1);

      const finalSummary = await page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary());
      expect(finalSummary?.selectedText).toContain('Ordinary selectable paragraph alpha sentinel');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps the selection toolbar stable while hovering it and scrolling the note', async () => {
    const { content, target } = createScrollableSelectionToolbarMarkdown();
    const { app, userDataRoot } = await launchIsolatedElectron('notes-selection-toolbar-hover-scroll-stability');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'selection-toolbar-hover-scroll-stability.md',
        content,
      });

      await scrollParagraphTextIntoSelectionView(page, target);
      const selected = await page.evaluate((targetText) =>
        (window as any).__vlainaE2E.selectEditorTextByText(targetText), target);
      expect(selected.selected).toBe(true);
      await expect(page.locator('.floating-toolbar.visible')).toBeVisible({ timeout: 5_000 });

      const point = await getVisibleToolbarActionCenter(page, 'bold');
      await page.mouse.move(point.x, point.y);
      await waitForEditorAnimationFrame(page);
      await page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        const scrollRoot = editor?.closest<HTMLElement>('[data-note-scroll-root="true"]');
        if (scrollRoot) {
          scrollRoot.scrollTop += 96;
        }
      });
      const frames = await collectToolbarPositionFrames(page, 450);
      const topJump = getToolbarTopJump(frames);

      expect(
        topJump,
        JSON.stringify({
          topJump,
          frames: frames.slice(0, 6).concat(frames.slice(-6)),
        }, null, 2),
      ).toBeLessThanOrEqual(3);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('allows mouse-drag text selection from a tag token edge', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-tag-token-edge-drag-selection');
    const tagText = '#drag-audit';
    const targetText = 'after tag selectable drag target sentinel text';

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'tag-token-edge-drag-selection.md',
        content: [
          '# Tag Token Edge Drag Selection',
          '',
          `Before ${tagText} ${targetText} continues after the token.`,
          '',
          'Trailing paragraph after tag selection.',
        ].join('\n'),
      });

      await expect(page.locator(`${EDITOR_SELECTOR} [data-editor-tag-token="true"]`, { hasText: tagText })).toBeVisible();

      const points = await getTagEdgeDragPoints(page, tagText, targetText);
      await page.mouse.move(points.start.x, points.start.y);
      await page.mouse.down();
      await page.mouse.move(points.end.x, points.end.y, { steps: 18 });
      await page.mouse.up();
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => page.evaluate(() =>
        (window as any).__vlainaE2E.getEditorSelectionSummary()
      ), {
        message: JSON.stringify(points),
      }).toMatchObject({
        empty: false,
        selectedText: expect.stringContaining('after tag selectable drag target sentinel'),
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('clears ordinary text selection when clicking outside the editor and toolbar', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-text-selection-clear-outside');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await openMarkdownFixture(page, {
        filename: 'text-selection-clear-outside.md',
        content: [
          '# Text Selection Clear Outside',
          '',
          TARGET_TEXT,
          '',
          'Clicking outside the editor should clear the selected text and hide the toolbar.',
        ].join('\n'),
      });

      const selected = await page.evaluate((text) =>
        (window as any).__vlainaE2E.selectEditorTextByText(text), TARGET_TEXT);
      expect(selected.selected).toBe(true);
      await expect.poll(async () => page.evaluate(() => {
        const toolbar = document.querySelector<HTMLElement>('.floating-toolbar');
        return {
          selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
          overlayCount: document.querySelectorAll('.editor-text-selection-overlay').length,
          toolbarVisible: Boolean(toolbar?.classList.contains('visible')),
        };
      })).toMatchObject({
        selection: {
          empty: false,
        },
        overlayCount: expect.any(Number),
        toolbarVisible: true,
      });

      await clickOutsideEditorAndToolbar(page);

      await expect.poll(async () => page.evaluate(() => {
        const toolbar = document.querySelector<HTMLElement>('.floating-toolbar');
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        return {
          selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
          nativeSelectedText: window.getSelection()?.toString() ?? '',
          overlayCount: document.querySelectorAll('.editor-text-selection-overlay').length,
          hasOverlayActiveClass: Boolean(editor?.classList.contains('editor-text-selection-overlay-active')),
          toolbarVisible: Boolean(toolbar?.classList.contains('visible')),
        };
      })).toMatchObject({
        selection: {
          empty: true,
          selectedText: '',
        },
        nativeSelectedText: '',
        overlayCount: 0,
        hasOverlayActiveClass: false,
        toolbarVisible: false,
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('collapses mouse-drag text selection at the clicked text position', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-text-selection-collapse-click-position');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await openMarkdownFixture(page, {
        filename: 'text-selection-collapse-click-position.md',
        content: [
          '# Text Selection Collapse Click Position',
          '',
          TARGET_TEXT,
          '',
          'Clicking inside selected text should place the caret at the clicked character.',
        ].join('\n'),
      });

      for (const offset of [
        Math.floor(TARGET_TEXT.length * 0.35),
        Math.floor(TARGET_TEXT.length * 0.72),
      ]) {
        await selectTextByMouseDrag(page, TARGET_TEXT);
        const selectedRange = await page.evaluate(() =>
          (window as any).__vlainaE2E.getEditorSelectionSummary()
        );
        expect(selectedRange?.empty).toBe(false);
        expect(selectedRange?.selectedText).toContain('Ordinary selectable paragraph alpha sentinel');
        const selectedFrom = selectedRange?.from ?? 0;

        const point = await getTextOffsetClickPoint(page, TARGET_TEXT, offset);
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await waitForEditorAnimationFrame(page);

        const whilePressed = await page.evaluate(() =>
          (window as any).__vlainaE2E.getEditorSelectionSummary()
        );
        expect(whilePressed?.empty).toBe(true);
        expect(whilePressed?.from).toBeGreaterThanOrEqual(selectedFrom + offset - 3);
        expect(whilePressed?.from).toBeLessThanOrEqual(selectedFrom + offset + 4);
        expect(whilePressed?.from).toBeGreaterThan(selectedFrom + 4);
        const pressedNativeCaret = await getNativeSelectionOffsetForText(page, TARGET_TEXT);
        expect(pressedNativeCaret.selectedText).toBe('');
        expect(pressedNativeCaret.isCollapsed).toBe(true);
        expect(pressedNativeCaret.anchorOffsetInText).not.toBeNull();
        const pressedAnchorOffset = pressedNativeCaret.anchorOffsetInText ?? Number.NaN;
        expect(pressedAnchorOffset).toBeGreaterThanOrEqual(offset - 3);
        expect(pressedAnchorOffset).toBeLessThanOrEqual(offset + 4);

        await page.mouse.up();
        const immediatelyAfterClick = await page.evaluate(() => ({
          selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
          nativeSelectedText: window.getSelection()?.toString() ?? '',
        }));
        expect(immediatelyAfterClick.nativeSelectedText).toBe('');
        expect(immediatelyAfterClick.selection?.empty).toBe(true);
        expect(immediatelyAfterClick.selection?.from).toBeGreaterThanOrEqual(selectedFrom + offset - 3);
        expect(immediatelyAfterClick.selection?.from).toBeLessThanOrEqual(selectedFrom + offset + 4);
        expect(immediatelyAfterClick.selection?.from).toBeGreaterThan(selectedFrom + 4);
        const immediateNativeCaret = await getNativeSelectionOffsetForText(page, TARGET_TEXT);
        expect(immediateNativeCaret.selectedText).toBe('');
        expect(immediateNativeCaret.isCollapsed).toBe(true);
        expect(immediateNativeCaret.anchorOffsetInText).not.toBeNull();
        const immediateAnchorOffset = immediateNativeCaret.anchorOffsetInText ?? Number.NaN;
        expect(immediateAnchorOffset).toBeGreaterThanOrEqual(offset - 3);
        expect(immediateAnchorOffset).toBeLessThanOrEqual(offset + 4);

        await expect.poll(async () => page.evaluate(() =>
          (window as any).__vlainaE2E.getEditorSelectionSummary()?.from ?? -1
        )).toBeGreaterThanOrEqual(selectedFrom + offset - 3);
        await expect.poll(async () => page.evaluate(() =>
          (window as any).__vlainaE2E.getEditorSelectionSummary()?.from ?? -1
        )).toBeLessThanOrEqual(selectedFrom + offset + 4);

        await expect.poll(async () => page.evaluate(() => {
          const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
          const toolbar = document.querySelector<HTMLElement>('.floating-toolbar');
          return {
            selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
            nativeSelectedText: window.getSelection()?.toString() ?? '',
            overlayCount: document.querySelectorAll('.editor-text-selection-overlay').length,
            hasPointerNativeClass: Boolean(editor?.classList.contains('editor-pointer-native-selection')),
            toolbarVisible: Boolean(toolbar?.classList.contains('visible')),
          };
        })).toMatchObject({
          selection: {
            empty: true,
            selectedText: '',
          },
          nativeSelectedText: '',
          overlayCount: 0,
          hasPointerNativeClass: false,
          toolbarVisible: false,
        });

        const collapsed = await page.evaluate(() => ({
          selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
        }));
        const caret = collapsed.selection;
        expect(caret?.from).toBeGreaterThanOrEqual(selectedFrom + offset - 3);
        expect(caret?.from).toBeLessThanOrEqual(selectedFrom + offset + 4);
        expect(caret?.from).toBeGreaterThan(selectedFrom + 4);
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('collapses overlay text selection at the clicked text position', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-overlay-selection-collapse-click-position');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await openMarkdownFixture(page, {
        filename: 'overlay-selection-collapse-click-position.md',
        content: [
          '# Overlay Selection Collapse Click Position',
          '',
          TARGET_TEXT,
          '',
          'Clicking inside an overlay-rendered selection should place the caret at the clicked character.',
        ].join('\n'),
      });

      await scrollParagraphTextIntoSelectionView(page, TARGET_TEXT);
      const selected = await page.evaluate((text) =>
        (window as any).__vlainaE2E.selectEditorTextByText(text), TARGET_TEXT);
      expect(selected.selected).toBe(true);

      const selectedRange = await page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        return {
          selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
          hasPointerNativeClass: Boolean(editor?.classList.contains('editor-pointer-native-selection')),
        };
      });
      expect(selectedRange.selection?.empty).toBe(false);
      expect(selectedRange.selection?.selectedText).toContain('Ordinary selectable paragraph alpha sentinel');
      expect(selectedRange.hasPointerNativeClass).toBe(false);

      const offset = Math.floor(TARGET_TEXT.length * 0.55);
      const selectedFrom = selectedRange.selection?.from ?? 0;
      const point = await getTextOffsetClickPoint(page, TARGET_TEXT, offset);
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await waitForEditorAnimationFrame(page);

      const whilePressed = await page.evaluate(() =>
        (window as any).__vlainaE2E.getEditorSelectionSummary()
      );
      expect(whilePressed?.empty).toBe(true);
      expect(whilePressed?.from).toBeGreaterThanOrEqual(selectedFrom + offset - 3);
      expect(whilePressed?.from).toBeLessThanOrEqual(selectedFrom + offset + 4);
      expect(whilePressed?.from).toBeGreaterThan(selectedFrom + 4);
      const pressedNativeCaret = await getNativeSelectionOffsetForText(page, TARGET_TEXT);
      expect(pressedNativeCaret.selectedText).toBe('');
      expect(pressedNativeCaret.isCollapsed).toBe(true);
      expect(pressedNativeCaret.anchorOffsetInText).not.toBeNull();
      const pressedAnchorOffset = pressedNativeCaret.anchorOffsetInText ?? Number.NaN;
      expect(pressedAnchorOffset).toBeGreaterThanOrEqual(offset - 3);
      expect(pressedAnchorOffset).toBeLessThanOrEqual(offset + 4);

      await page.mouse.up();
      const immediatelyAfterClick = await page.evaluate(() => ({
        selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
        nativeSelectedText: window.getSelection()?.toString() ?? '',
      }));
      expect(immediatelyAfterClick.nativeSelectedText).toBe('');
      expect(immediatelyAfterClick.selection?.empty).toBe(true);
      expect(immediatelyAfterClick.selection?.from).toBeGreaterThanOrEqual(selectedFrom + offset - 3);
      expect(immediatelyAfterClick.selection?.from).toBeLessThanOrEqual(selectedFrom + offset + 4);
      expect(immediatelyAfterClick.selection?.from).toBeGreaterThan(selectedFrom + 4);
      const immediateNativeCaret = await getNativeSelectionOffsetForText(page, TARGET_TEXT);
      expect(immediateNativeCaret.selectedText).toBe('');
      expect(immediateNativeCaret.isCollapsed).toBe(true);
      expect(immediateNativeCaret.anchorOffsetInText).not.toBeNull();
      const immediateAnchorOffset = immediateNativeCaret.anchorOffsetInText ?? Number.NaN;
      expect(immediateAnchorOffset).toBeGreaterThanOrEqual(offset - 3);
      expect(immediateAnchorOffset).toBeLessThanOrEqual(offset + 4);

      await expect.poll(async () => page.evaluate(() =>
        (window as any).__vlainaE2E.getEditorSelectionSummary()?.from ?? -1
      )).toBeGreaterThanOrEqual(selectedFrom + offset - 3);
      await expect.poll(async () => page.evaluate(() =>
        (window as any).__vlainaE2E.getEditorSelectionSummary()?.from ?? -1
      )).toBeLessThanOrEqual(selectedFrom + offset + 4);

      await expect.poll(async () => page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        return {
          selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
          nativeSelectedText: window.getSelection()?.toString() ?? '',
          overlayCount: document.querySelectorAll('.editor-text-selection-overlay').length,
          hasPointerNativeClass: Boolean(editor?.classList.contains('editor-pointer-native-selection')),
        };
      })).toMatchObject({
        selection: {
          empty: true,
          selectedText: '',
        },
        nativeSelectedText: '',
        overlayCount: 0,
        hasPointerNativeClass: false,
      });

      const collapsed = await page.evaluate(() =>
        (window as any).__vlainaE2E.getEditorSelectionSummary()
      );
      expect(collapsed?.from).toBeGreaterThanOrEqual(selectedFrom + offset - 3);
      expect(collapsed?.from).toBeLessThanOrEqual(selectedFrom + offset + 4);
      expect(collapsed?.from).toBeGreaterThan(selectedFrom + 4);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('clears mouse-drag text selection when clicking blank space in the note body', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-text-selection-clear-note-blank');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await openMarkdownFixture(page, {
        filename: 'text-selection-clear-note-blank.md',
        content: [
          '# Text Selection Clear Note Blank',
          '',
          TARGET_TEXT,
          '',
          'Clicking blank note body space should clear selected text and hide the toolbar.',
        ].join('\n'),
      });

      for (const kind of ['right-text-gap', 'left-text-gap', 'below-last-block'] as const) {
        const point = await getNoteBodyBlankClickPoint(page, TARGET_TEXT, kind);
        await selectTextByMouseDrag(page, TARGET_TEXT);
        await page.mouse.click(point.x, point.y);
        await waitForEditorAnimationFrame(page);

        await expect.poll(async () => page.evaluate(() => {
          const toolbar = document.querySelector<HTMLElement>('.floating-toolbar');
          const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
          return {
            selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
            nativeSelectedText: window.getSelection()?.toString() ?? '',
            overlayCount: document.querySelectorAll('.editor-text-selection-overlay').length,
            hasOverlayActiveClass: Boolean(editor?.classList.contains('editor-text-selection-overlay-active')),
            toolbarVisible: Boolean(toolbar?.classList.contains('visible')),
          };
        })).toMatchObject({
          selection: {
            empty: true,
            selectedText: '',
          },
          nativeSelectedText: '',
          overlayCount: 0,
          hasOverlayActiveClass: false,
          toolbarVisible: false,
        });
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('clears overlay text selection on blank note body mousedown without repainting a shorter blue range', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-overlay-selection-clear-note-blank-mousedown');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await openMarkdownFixture(page, {
        filename: 'overlay-selection-clear-note-blank-mousedown.md',
        content: [
          '# Overlay Selection Clear Note Blank Mousedown',
          '',
          TARGET_TEXT,
          '',
          'Clicking blank note body space should clear selected text on pointer down.',
        ].join('\n'),
      });

      for (const kind of ['right-text-gap', 'left-text-gap', 'below-last-block'] as const) {
        await scrollParagraphTextIntoSelectionView(page, TARGET_TEXT);
        const selected = await page.evaluate((text) =>
          (window as any).__vlainaE2E.selectEditorTextByText(text), TARGET_TEXT);
        expect(selected.selected).toBe(true);

        const beforeClick = await page.evaluate(() => {
          const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
          return {
            selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
            nativeSelectedText: window.getSelection()?.toString() ?? '',
            overlayCount: document.querySelectorAll('.editor-text-selection-overlay').length,
            hasPointerNativeClass: Boolean(editor?.classList.contains('editor-pointer-native-selection')),
          };
        });
        expect(beforeClick.selection?.empty).toBe(false);
        expect(beforeClick.overlayCount).toBeGreaterThan(0);
        expect(beforeClick.hasPointerNativeClass).toBe(false);

        const point = await getNoteBodyBlankClickPoint(page, TARGET_TEXT, kind);
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await waitForEditorAnimationFrame(page);

        const whilePressed = await page.evaluate(() => {
          const toolbar = document.querySelector<HTMLElement>('.floating-toolbar');
          const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
          return {
            selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
            nativeSelectedText: window.getSelection()?.toString() ?? '',
            overlayCount: document.querySelectorAll('.editor-text-selection-overlay').length,
            hasOverlayActiveClass: Boolean(editor?.classList.contains('editor-text-selection-overlay-active')),
            hasPointerNativeClass: Boolean(editor?.classList.contains('editor-pointer-native-selection')),
            toolbarVisible: Boolean(toolbar?.classList.contains('visible')),
          };
        });

        expect(whilePressed, JSON.stringify({ kind, point, beforeClick, whilePressed }, null, 2)).toMatchObject({
          selection: {
            empty: true,
            selectedText: '',
          },
          nativeSelectedText: '',
          overlayCount: 0,
          hasOverlayActiveClass: false,
          hasPointerNativeClass: false,
          toolbarVisible: false,
        });

        await page.mouse.up();
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps repeated ordinary text selection rendering responsive in a large note', async () => {
    const { content, targets } = createLargeTextSelectionMarkdown(120);
    const sampledTargets = Array.from({ length: 10 }, () => targets[60]);
    const { app, userDataRoot } = await launchIsolatedElectron('notes-text-selection-performance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await openMarkdownFixture(page, {
        filename: 'text-selection-performance.md',
        content,
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Final text selection performance sentinel');
      await waitForEditorAnimationFrame(page);

      const metrics = await measureRepeatedEditorTextSelection(page, sampledTargets);
      console.info('[notes-text-selection-performance]', metrics);

      expect(metrics.samples).toHaveLength(sampledTargets.length);
      expect(metrics.minSelectedTextLength).toBeGreaterThan(40);
      expect(metrics.maxOverlayCount).toBeLessThanOrEqual(6);
      expect(metrics.p95Ms).toBeLessThan(1_500);
      expect(metrics.maxMs).toBeLessThan(2_500);
      expect(metrics.maxFrameMs).toBeLessThan(250);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
