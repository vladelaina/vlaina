import { expect, test, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  installReferenceTyporaTheme,
} from './notesE2E';

const EDITOR_SELECTOR = '.milkdown .ProseMirror';
const SELECTED_BLOCK_SELECTOR = `${EDITOR_SELECTOR} .editor-block-selected`;
const MANUAL_MARKDOWN_PATH = path.resolve(process.cwd(), 'test/e2e/notes-manual-performance.md');

async function waitForE2EBridge(page: Page) {
  await page.waitForFunction(() => Boolean((window as any).__vlainaE2E));
  await page.evaluate(() => (window as any).__vlainaE2E.waitForUnifiedLoaded());
}

async function launchIsolatedElectron(): Promise<{
  app: ElectronApplication;
  userDataRoot: string;
}> {
  const userDataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vlaina-notes-manual-performance-e2e-'));
  const userDataDir = path.join(userDataRoot, 'user-data');

  const app = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: 'http://127.0.0.1:3100?e2e=1',
      VLAINA_USER_DATA_DIR: userDataDir,
      APP_API_BASE_URL: 'http://127.0.0.1:9',
      APP_UPDATE_MANIFEST_URL: 'http://127.0.0.1:9/latest',
      NO_PROXY: '127.0.0.1,localhost',
      no_proxy: '127.0.0.1,localhost',
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      ALL_PROXY: '',
      http_proxy: '',
      https_proxy: '',
      all_proxy: '',
    },
  });

  return { app, userDataRoot };
}

async function closeElectron(app: ElectronApplication): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  await Promise.race([
    app.close().finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }),
    new Promise<void>((resolve) => {
      timeoutId = setTimeout(() => {
        app.process()?.kill('SIGKILL');
        resolve();
      }, 5000);
    }),
  ]).catch(() => {
    app.process()?.kill('SIGKILL');
  });
}

test.describe('notes manual markdown performance', () => {
  test.setTimeout(120_000);

  test('opens and renders test/e2e/notes-manual-performance.md under an imported Typora theme', async () => {
    const manualMarkdown = await fs.readFile(MANUAL_MARKDOWN_PATH, 'utf8');
    expect(manualMarkdown.trim().length).toBeGreaterThan(0);

    const { app, userDataRoot } = await launchIsolatedElectron();
    const milkdownTimings: string[] = [];

    try {
      await app.firstWindow();
      const [page] = app.windows();
      if (!page) {
        throw new Error('Electron did not create a window');
      }
      await waitForE2EBridge(page);

      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:')) {
          milkdownTimings.push(text);
          console.info(text);
        }
      });

      const installedTheme = await installReferenceTyporaTheme(page, 'vlook-fancy.css');
      console.info('[notes-manual-performance-typora-theme]', installedTheme);

      const { notePath } = await page.evaluate((content) =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'notes-manual-performance.md',
          content,
        }), manualMarkdown);

      const openStartedAt = Date.now();
      const openTiming = await page.evaluate((pathToOpen) =>
        (window as any).__vlainaE2E.openAbsoluteNoteWithTiming(pathToOpen), notePath);
      const openActionWallMs = Date.now() - openStartedAt;

      let firstVisibleBlockMs = 0;
      await expect.poll(async () => page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        const scrollRoot = editor?.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
        const scrollRootRect = scrollRoot?.getBoundingClientRect();
        const viewport = scrollRootRect ?? { top: 0, bottom: window.innerHeight };
        const candidates = Array.from(editor?.querySelectorAll<HTMLElement>(
          'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,table'
        ) ?? []);
        const firstVisibleBlock = candidates.find((element) => {
          if (!element.textContent?.trim()) {
            return false;
          }
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.bottom > viewport.top && rect.top < viewport.bottom;
        });

        return {
          hasEditor: Boolean(editor),
          editorTextLength: editor?.textContent?.length ?? 0,
          firstVisibleText: firstVisibleBlock?.textContent?.trim().slice(0, 120) ?? '',
          hasSourceFallback: Boolean(document.querySelector('[data-note-source-fallback="true"]')),
        };
      }).then((state) => {
        if (state.firstVisibleText && firstVisibleBlockMs === 0) {
          firstVisibleBlockMs = Date.now() - openStartedAt;
        }
        return state;
      }), { timeout: 30_000 }).toMatchObject({
        hasEditor: true,
        hasSourceFallback: false,
        firstVisibleText: expect.stringMatching(/\S/),
      });

      const selectableStartedAt = Date.now();
      await expect.poll(async () => page.evaluate(() => {
        const startedAt = performance.now();
        const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks();
        return {
          count: blocks.length,
          durationMs: performance.now() - startedAt,
        };
      }).then((result) => result.count), { timeout: 30_000 }).toBeGreaterThan(0);
      const selectableReadyMs = Date.now() - selectableStartedAt;

      const domMetrics = await page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        const scrollRoot = editor?.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
        const blockElements = Array.from(editor?.querySelectorAll<HTMLElement>(
          'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,table'
        ) ?? []);
        const countsByTagName = blockElements.reduce<Record<string, number>>((counts, element) => {
          counts[element.tagName] = (counts[element.tagName] ?? 0) + 1;
          return counts;
        }, {});
        const selectableStartedAt = performance.now();
        const selectableBlocks = (window as any).__vlainaE2E.getNoteSelectableBlocks();
        const selectableMeasureMs = performance.now() - selectableStartedAt;
        return {
          editorTextLength: editor?.textContent?.length ?? 0,
          editorChildCount: editor?.children.length ?? 0,
          renderedBlockCount: blockElements.length,
          selectableBlockCount: selectableBlocks.length,
          selectableMeasureMs: Math.round(selectableMeasureMs * 10) / 10,
          scrollHeight: scrollRoot?.scrollHeight ?? 0,
          clientHeight: scrollRoot?.clientHeight ?? 0,
          countsByTagName,
          firstSelectableText: selectableBlocks[0]?.text?.slice(0, 120) ?? '',
          sourceFallbackCount: document.querySelectorAll('[data-note-source-fallback="true"]').length,
        };
      });

      const scrollMetrics = await page.evaluate(async () => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        const scrollRoot = editor?.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
        if (!scrollRoot || scrollRoot.scrollHeight <= scrollRoot.clientHeight) {
          return null;
        }

        const frameDeltas: number[] = [];
        scrollRoot.scrollTop = 0;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const startedAt = performance.now();
        let lastFrameAt = startedAt;
        const maxScrollTop = scrollRoot.scrollHeight - scrollRoot.clientHeight;
        const frames = 60;
        for (let index = 1; index <= frames; index += 1) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const now = performance.now();
          frameDeltas.push(now - lastFrameAt);
          scrollRoot.scrollTop = Math.round((maxScrollTop * index) / frames);
          lastFrameAt = now;
        }
        const totalMs = performance.now() - startedAt;
        const sortedDeltas = [...frameDeltas].sort((a, b) => a - b);
        const p95Index = Math.min(sortedDeltas.length - 1, Math.max(0, Math.ceil(sortedDeltas.length * 0.95) - 1));

        return {
          frames,
          totalMs: Math.round(totalMs),
          avgFrameMs: Math.round((frameDeltas.reduce((sum, value) => sum + value, 0) / frameDeltas.length) * 10) / 10,
          p95FrameMs: Math.round((sortedDeltas[p95Index] ?? 0) * 10) / 10,
          maxFrameMs: Math.round(Math.max(...frameDeltas) * 10) / 10,
          finalScrollTop: scrollRoot.scrollTop,
          maxScrollTop,
        };
      });

      const blockScanRepeatMetrics = await page.evaluate(() => {
        const summarize = (samples: number[]) => {
          const sorted = [...samples].sort((a, b) => a - b);
          const pick = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] ?? 0;
          const average = samples.reduce((sum, value) => sum + value, 0) / Math.max(1, samples.length);
          return {
            minMs: Math.round((sorted[0] ?? 0) * 10) / 10,
            avgMs: Math.round(average * 10) / 10,
            p50Ms: Math.round(pick(0.5) * 10) / 10,
            p95Ms: Math.round(pick(0.95) * 10) / 10,
            maxMs: Math.round((sorted[sorted.length - 1] ?? 0) * 10) / 10,
          };
        };

        const samples: number[] = [];
        let blockCount = 0;
        const iterations = 30;
        for (let index = 0; index < iterations; index += 1) {
          const startedAt = performance.now();
          const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks();
          samples.push(performance.now() - startedAt);
          blockCount = blocks.length;
        }

        return {
          iterations,
          blockCount,
          ...summarize(samples),
        };
      });

      const programmaticBlockSelectionMetrics = await page.evaluate(async () => {
        const selectableBlocks = (window as any).__vlainaE2E.getNoteSelectableBlocks();
        const seenTexts = new Set<string>();
        const uniqueTexts: string[] = [];
        selectableBlocks.forEach((block: { text?: string }) => {
          const text = (block.text ?? '').trim();
          if (!text || seenTexts.has(text)) {
            return;
          }
          seenTexts.add(text);
          uniqueTexts.push(text);
        });

        const counts = [1, 3, 10, 25, 50].filter((count) => count <= uniqueTexts.length);
        const results = [];
        for (const count of counts) {
          await (window as any).__vlainaE2E.selectNoteBlocksByText([]);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const startedAt = performance.now();
          const selectedViaBridge = await (window as any).__vlainaE2E.selectNoteBlocksByText(uniqueTexts.slice(0, count));
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const durationMs = performance.now() - startedAt;
          results.push({
            requestedCount: count,
            selectedViaBridge,
            selectedDomCount: document.querySelectorAll('.milkdown .ProseMirror .editor-block-selected').length,
            durationMs: Math.round(durationMs * 10) / 10,
          });
        }

        return {
          availableUniqueTextCount: uniqueTexts.length,
          testedCounts: counts,
          results,
        };
      });

      const selectedScrollMetrics = await page.evaluate(async () => {
        const selectedCount = document.querySelectorAll('.milkdown .ProseMirror .editor-block-selected').length;
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        const scrollRoot = editor?.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
        if (!scrollRoot || scrollRoot.scrollHeight <= scrollRoot.clientHeight) {
          return null;
        }

        const frameDeltas: number[] = [];
        scrollRoot.scrollTop = 0;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const startedAt = performance.now();
        let lastFrameAt = startedAt;
        const maxScrollTop = scrollRoot.scrollHeight - scrollRoot.clientHeight;
        const frames = 60;
        for (let index = 1; index <= frames; index += 1) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const now = performance.now();
          frameDeltas.push(now - lastFrameAt);
          scrollRoot.scrollTop = Math.round((maxScrollTop * index) / frames);
          lastFrameAt = now;
        }
        const totalMs = performance.now() - startedAt;
        const sortedDeltas = [...frameDeltas].sort((a, b) => a - b);
        const p95Index = Math.min(sortedDeltas.length - 1, Math.max(0, Math.ceil(sortedDeltas.length * 0.95) - 1));

        return {
          selectedCount,
          frames,
          totalMs: Math.round(totalMs),
          avgFrameMs: Math.round((frameDeltas.reduce((sum, value) => sum + value, 0) / frameDeltas.length) * 10) / 10,
          p95FrameMs: Math.round((sortedDeltas[p95Index] ?? 0) * 10) / 10,
          maxFrameMs: Math.round(Math.max(...frameDeltas) * 10) / 10,
        };
      });

      const dragTarget = await page.evaluate(async () => {
        await (window as any).__vlainaE2E.selectNoteBlocksByText([]);
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        const scrollRoot = editor?.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
        if (!editor || !scrollRoot) {
          return null;
        }

        scrollRoot.scrollTop = 0;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        const scrollRootRect = scrollRoot.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        const block = Array.from(editor.querySelectorAll<HTMLElement>('p,li,blockquote,pre,table,h1,h2,h3,h4,h5,h6'))
          .find((element) => {
            if (!element.textContent?.trim()) {
              return false;
            }
            const rect = element.getBoundingClientRect();
            return rect.width > 0 &&
              rect.height > 0 &&
              rect.bottom > scrollRootRect.top + 24 &&
              rect.top < scrollRootRect.bottom - 24;
          });
        if (!block) {
          return null;
        }

        const rect = block.getBoundingClientRect();
        const startX = Math.min(scrollRootRect.right - 24, editorRect.right + 72);
        const visibleTop = Math.max(rect.top, scrollRootRect.top + 24);
        const visibleBottom = Math.min(rect.bottom, scrollRootRect.bottom - 24);
        const startY = visibleTop + Math.max(12, (visibleBottom - visibleTop) * 0.35);
        const hit = document.elementFromPoint(startX, startY);
        return {
          startX,
          startY,
          endX: Math.max(editorRect.left + 24, rect.left + 24),
          endY: Math.min(scrollRootRect.bottom - 24, startY + 220),
          targetTagName: block.tagName,
          targetText: block.textContent?.trim().slice(0, 120) ?? '',
          hitTagName: hit instanceof HTMLElement ? hit.tagName : null,
          hitClassName: hit instanceof HTMLElement ? String(hit.className) : null,
          hitInsideEditor: hit instanceof Node && editor.contains(hit),
        };
      });
      expect(dragTarget).not.toBeNull();

      const dragStartedAt = Date.now();
      await page.mouse.move(dragTarget!.startX, dragTarget!.startY);
      await page.mouse.down();
      await page.mouse.move(dragTarget!.endX, dragTarget!.endY, { steps: 10 });
      await page.mouse.up();
      const mouseGestureMs = Date.now() - dragStartedAt;

      const selectionVisibleStartedAt = Date.now();
      const selectionVisible = await page.locator(SELECTED_BLOCK_SELECTOR).first()
        .waitFor({ state: 'visible', timeout: 3_000 })
        .then(() => true, () => false);
      const selectionVisibleMs = Date.now() - selectionVisibleStartedAt;

      const dragSelectionMetrics = await page.evaluate(() => ({
        selectedDomCount: document.querySelectorAll('.milkdown .ProseMirror .editor-block-selected').length,
        dragBoxCount: document.querySelectorAll('[data-editor-drag-box="true"]').length,
        pending: document.querySelector('.milkdown .ProseMirror')?.classList.contains('editor-block-selection-pending') ?? false,
        active: document.querySelector('.milkdown .ProseMirror')?.classList.contains('editor-block-selection-active') ?? false,
      }));

      const metrics = {
        contentChars: manualMarkdown.length,
        contentBytes: Buffer.byteLength(manualMarkdown, 'utf8'),
        storeOpenMs: Math.round(openTiming.totalMs),
        openActionWallMs,
        firstVisibleBlockFromOpenMs: firstVisibleBlockMs,
        selectableReadyAfterOpenActionMs: selectableReadyMs,
        domMetrics,
        scrollMetrics,
        blockScanRepeatMetrics,
        programmaticBlockSelectionMetrics,
        selectedScrollMetrics,
        dragSelectionMetrics: {
          dragTarget,
          mouseGestureMs,
          selectionVisible,
          selectionVisibleMs,
          dragSelectTotalMs: Date.now() - dragStartedAt,
          ...dragSelectionMetrics,
        },
        milkdownTimingLogCount: milkdownTimings.length,
        importedTheme: installedTheme,
      };

      console.info('[notes-manual-performance]', JSON.stringify(metrics, null, 2));

      expect(openTiming.currentNoteContentLength).toBeGreaterThan(0);
      expect(domMetrics.sourceFallbackCount).toBe(0);
      expect(domMetrics.editorTextLength).toBeGreaterThan(0);
      expect(domMetrics.selectableBlockCount).toBeGreaterThan(0);
      expect(blockScanRepeatMetrics.blockCount).toBeGreaterThan(0);
      expect(programmaticBlockSelectionMetrics.results.length).toBeGreaterThan(0);
    } finally {
      await closeElectron(app);
      await fs.rm(userDataRoot, { recursive: true, force: true }).catch(() => {});
    }
  });
});
