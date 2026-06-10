import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

function createLongParagraph(index: number): string {
  const sentence = [
    `Paragraph ${index}: this is a long rendered paragraph used for note open performance measurement.`,
    'It intentionally contains enough plain text to wrap across many visual lines in the editor.',
    'The goal is to exercise markdown parsing, Milkdown document creation, DOM rendering, line layout, and block selection readiness with realistic large-note content.',
    'Repeated prose also catches regressions where text measurement, decoration building, or block hit testing scales with total character count instead of visible blocks.',
  ].join(' ');
  return Array.from({ length: 12 }, () => sentence).join(' ');
}

function createLongMarkdown(blockCount: number): string {
  const blocks: string[] = ['# Long Open Performance', ''];
  for (let index = 0; index < blockCount; index += 1) {
    blocks.push(createLongParagraph(index), '');
  }
  blocks.push('Final performance sentinel paragraph.');
  return blocks.join('\n');
}

async function measureLongNoteOpenAndDrag(page: Page, notePath: string, contentCharCount: number, label: string) {
  const openTiming = await page.evaluate((pathToOpen) =>
    (window as any).__vlainaE2E.openAbsoluteNoteWithTiming(pathToOpen), notePath);
  const storeOpenMs = Math.round(openTiming.totalMs);

  const firstPaintStartedAt = Date.now();
  let previewFirstPaintMs: number | null = null;
  let editorFirstPaintMs: number | null = null;
  await expect.poll(async () => page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    const firstParagraph = Array.from(editor?.children ?? [])
      .find((element): element is HTMLElement => (
        element instanceof HTMLElement &&
        element.tagName === 'P' &&
        element.textContent?.startsWith('Paragraph 0:') === true
      ));
    const scrollRoot = editor?.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
    const rect = firstParagraph?.getBoundingClientRect();
    const scrollRootRect = scrollRoot?.getBoundingClientRect();
    const preview = document.querySelector<HTMLElement>('[data-note-first-paint-preview="true"]');
    const previewParagraph = preview?.querySelector<HTMLElement>('[data-note-preview-block="paragraph"]');
    const previewRect = previewParagraph?.getBoundingClientRect();
    const previewScrollRoot = preview?.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
    const previewScrollRootRect = previewScrollRoot?.getBoundingClientRect();
    const previewViewportRect = previewScrollRootRect ?? {
      top: 0,
      bottom: window.innerHeight,
    };
    const previewVisible = Boolean(
      previewRect &&
      previewRect.width > 0 &&
      previewRect.height > 0 &&
      previewRect.bottom > previewViewportRect.top &&
      previewRect.top < previewViewportRect.bottom &&
      previewParagraph?.textContent?.startsWith('Paragraph 0:') === true
    );
    const firstParagraphVisible = Boolean(
      rect &&
      scrollRootRect &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > scrollRootRect.top &&
      rect.top < scrollRootRect.bottom
    );
    return {
      hasEditor: Boolean(editor),
      hasFirstParagraph: Boolean(firstParagraph),
      previewVisible,
      firstParagraphVisible,
    };
  }).then((state) => {
    const elapsedMs = Date.now() - firstPaintStartedAt;
    if (state.previewVisible && previewFirstPaintMs === null) {
      previewFirstPaintMs = elapsedMs;
    }
    if (state.firstParagraphVisible && editorFirstPaintMs === null) {
      editorFirstPaintMs = elapsedMs;
    }
    return state;
  }), { timeout: 30_000 }).toMatchObject({
    hasEditor: true,
    hasFirstParagraph: true,
    firstParagraphVisible: true,
  });
  const firstParagraphVisibleMs = editorFirstPaintMs ?? Date.now() - firstPaintStartedAt;

  const selectableStartedAt = Date.now();
  await expect.poll(async () => page.evaluate(() => {
    const editor = document.querySelector('.milkdown .ProseMirror');
    const sourceFallback = document.querySelector('[data-note-source-fallback="true"]');
    const selectableBlocks = (window as any).__vlainaE2E.getNoteSelectableBlocks();
    return {
      hasEditor: Boolean(editor),
      hasSourceFallback: Boolean(sourceFallback),
      selectableCount: selectableBlocks.length,
      firstText: selectableBlocks[0]?.text ?? '',
    };
  }), { timeout: 30_000 }).toMatchObject({
    hasEditor: true,
    hasSourceFallback: false,
    selectableCount: expect.any(Number),
    firstText: expect.stringContaining('Long Open Performance'),
  });
  const selectableReadyMs = Date.now() - selectableStartedAt;
  console.info(`[notes-open-performance-open:${label}]`, {
    contentCharCount,
    storeOpenMs,
    previewFirstPaintMs,
    firstParagraphVisibleMs,
    selectableReadyMs,
  });

  const dragMetrics = await page.evaluate(async () => {
    const paragraph = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror p'))
      .find((element) => element.textContent?.includes('Paragraph 0:'));
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    if (!paragraph) {
      return null;
    }
    paragraph.scrollIntoView({ block: 'center', inline: 'nearest' });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const rect = paragraph.getBoundingClientRect();
    const editorRect = editor?.getBoundingClientRect() ?? rect;
    const scrollRootRect = editor?.closest('[data-note-scroll-root="true"]')?.getBoundingClientRect() ?? editorRect;
    const startX = Math.min(scrollRootRect.right - 24, editorRect.right + 72);
    const visibleTop = Math.max(rect.top, scrollRootRect.top + 24);
    const visibleBottom = Math.min(rect.bottom, scrollRootRect.bottom - 24);
    const startY = visibleTop + Math.max(16, (visibleBottom - visibleTop) * 0.35);
    const hit = document.elementFromPoint(startX, startY);
    return {
      startX,
      startY,
      endX: Math.max(editorRect.left + 24, rect.left + 24),
      endY: Math.min(scrollRootRect.bottom - 24, startY + 160),
      paragraphLeft: rect.left,
      paragraphRight: rect.right,
      editorLeft: editorRect.left,
      editorRight: editorRect.right,
      scrollRootLeft: scrollRootRect.left,
      scrollRootRight: scrollRootRect.right,
      hitTagName: hit instanceof HTMLElement ? hit.tagName : null,
      hitClassName: hit instanceof HTMLElement ? hit.className : null,
      hitInsideEditor: hit instanceof Node && Boolean(editor?.contains(hit)),
    };
  });
  expect(dragMetrics).not.toBeNull();

  const dragStartedAt = Date.now();
  await page.mouse.move(dragMetrics!.startX, dragMetrics!.startY);
  await page.mouse.down();
  await page.mouse.move(dragMetrics!.endX, dragMetrics!.endY, { steps: 6 });
  await page.mouse.up();
  const mouseGestureMs = Date.now() - dragStartedAt;
  const dragDiagnostics = await page.evaluate(() => ({
    selectedCount: document.querySelectorAll('.milkdown .ProseMirror .editor-block-selected').length,
    dragBoxCount: document.querySelectorAll('[data-editor-drag-box="true"]').length,
    pending: document.querySelector('.milkdown .ProseMirror')?.classList.contains('editor-block-selection-pending') ?? false,
    active: document.querySelector('.milkdown .ProseMirror')?.classList.contains('editor-block-selection-active') ?? false,
  }));
  console.info(`[notes-open-performance-drag:${label}]`, {
    dragMetrics,
    dragDiagnostics,
  });
  const selectionVisibleStartedAt = Date.now();
  await expect(page.locator(SELECTED_BLOCK_SELECTOR).first()).toBeVisible({ timeout: 10_000 });
  const selectionVisibleMs = Date.now() - selectionVisibleStartedAt;
  const dragSelectMs = Date.now() - dragStartedAt;

  const finalMetrics = await page.evaluate(() => ({
    selectedCount: document.querySelectorAll('.milkdown .ProseMirror .editor-block-selected').length,
    blockCount: (window as any).__vlainaE2E.getNoteSelectableBlocks().length,
    sourceFallbackCount: document.querySelectorAll('[data-note-source-fallback="true"]').length,
  }));

  console.info(`[notes-open-performance:${label}]`, {
    contentCharCount,
    storeOpenMs,
    previewFirstPaintMs,
    firstParagraphVisibleMs,
    selectableReadyMs,
    mouseGestureMs,
    selectionVisibleMs,
    dragSelectMs,
    ...finalMetrics,
  });

  expect(finalMetrics.sourceFallbackCount).toBe(0);
  expect(contentCharCount).toBeGreaterThan(2_000_000);
  expect(finalMetrics.blockCount).toBeGreaterThan(1000);
  expect(finalMetrics.selectedCount).toBeGreaterThan(0);
}

test.describe('notes long markdown open performance', () => {
  test.setTimeout(120_000);

  test('cold-opens a long markdown note as rendered Milkdown', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-open-performance-cold');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:')) {
          console.info(text);
        }
      });

      const content = createLongMarkdown(650);
      const contentCharCount = content.length;
      const { notePath } = await page.evaluate((markdown) =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'cold-long-open-performance.md',
          content: markdown,
        }), content);

      await measureLongNoteOpenAndDrag(page, notePath, contentCharCount, 'cold');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('opens a long markdown note as rendered Milkdown and supports immediate block drag selection', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-open-performance-switch');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:')) {
          console.info(text);
        }
      });
      const { notePath: warmupNotePath } = await page.evaluate(() =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'warmup.md',
          content: '# Warmup\n\nSmall note before the long markdown measurement.',
        }));
      await page.evaluate((pathToOpen) => (window as any).__vlainaE2E.openAbsoluteNote(pathToOpen), warmupNotePath);
      await expect(page.locator(EDITOR_SELECTOR)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Small note before' })).toBeVisible({ timeout: 30_000 });

      const content = createLongMarkdown(650);
      const contentCharCount = content.length;
      const { notePath } = await page.evaluate((markdown) =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'long-open-performance.md',
          content: markdown,
        }), content);

      await measureLongNoteOpenAndDrag(page, notePath, contentCharCount, 'switch');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
