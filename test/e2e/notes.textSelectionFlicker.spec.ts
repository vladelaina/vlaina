import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
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
      await page.mouse.move(points.start.x, points.start.y);
      await page.mouse.down();
      const duringDragFramesPromise = collectSelectionFrames(page, 250);
      await page.mouse.move(points.end.x, points.end.y, { steps: 24 });
      const duringDragFrames = await duringDragFramesPromise;
      await page.mouse.up();
      const settledFrames = await collectSelectionFrames(page, 500);

      const duringDragHasVisibleSelection = duringDragFrames.some((frame) =>
        frame.nativeSelectedText.length > 0 || frame.selectedText.length > 0 || frame.overlayCount > 0
      );
      const settledNonEmptyFrames = settledFrames.filter((frame) =>
        frame.selectedText.length > 0 || frame.nativeSelectedText.length > 0 || frame.overlayCount > 0
      );

      expect(duringDragHasVisibleSelection).toBe(true);
      expect(settledNonEmptyFrames.length).toBeGreaterThan(Math.floor(settledFrames.length * 0.8));
      expect(countBooleanTransitions(settledFrames, 'hasOverlayActiveClass')).toBeLessThanOrEqual(1);
      expect(countBooleanTransitions(settledFrames, 'toolbarVisible')).toBeLessThanOrEqual(1);

      const finalSummary = await page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary());
      expect(finalSummary?.selectedText).toContain('Ordinary selectable paragraph alpha sentinel');
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
