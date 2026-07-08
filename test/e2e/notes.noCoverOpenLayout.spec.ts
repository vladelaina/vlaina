import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  NOTE_COVER_REGION_SELECTOR,
  cleanupIsolatedElectron,
  createNotesRootFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openNotesRootInNotes,
} from './notesE2E';

const NOTE_COVER_ADD_OVERLAY_SELECTOR = '[data-note-cover-add-overlay="true"]';

const COVER_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">',
  '<rect width="1200" height="400" fill="#2563eb"/>',
  '<rect x="80" y="120" width="520" height="52" rx="16" fill="#ffffff" opacity="0.55"/>',
  '</svg>',
].join('');

type LayoutSample = {
  frame: number;
  currentPath: string | null;
  editorText: string;
  coverCount: number;
  placeholderCount: number;
  contentTop: number | null;
  editorTop: number | null;
  headingTop: number | null;
  paragraphTop: number | null;
  headerTop: number | null;
  headerHeight: number | null;
};

async function startNoCoverLayoutProbe(page: Page) {
  await page.evaluate(() => {
    const globalWindow = window as typeof window & {
      __vlainaNoCoverLayoutProbe?: {
        samples: LayoutSample[];
        stop: () => LayoutSample[];
      };
    };

    globalWindow.__vlainaNoCoverLayoutProbe?.stop();
    const samples: LayoutSample[] = [];
    let frame = 0;
    let stopped = false;
    let animationFrame = 0;

    const readRectTop = (element: Element | null) => {
      if (!(element instanceof HTMLElement)) {
        return null;
      }
      return Math.round(element.getBoundingClientRect().top);
    };

    const tick = () => {
      if (stopped) return;
      const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
      const contentRoot = document.querySelector<HTMLElement>('[data-note-content-root="true"]');
      const heading = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror h1'))
        .find((element) => element.textContent?.includes('Plain No Cover')) ?? null;
      const paragraph = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror p'))
        .find((element) => element.textContent?.includes('No cover first paragraph sentinel')) ?? null;
      const header = document.querySelector<HTMLElement>('[data-no-editor-drag-box="true"].milkdown-editor, [data-no-editor-drag-box="true"]');
      const state = (window as any).__vlainaE2E?.getNotesState?.();

      samples.push({
        frame,
        currentPath: state?.currentNote?.path ?? null,
        editorText: (editor?.textContent ?? '').slice(0, 160),
        coverCount: document.querySelectorAll('[data-note-cover-region="true"]').length,
        placeholderCount: document.querySelectorAll('[data-note-cover-placeholder="true"]').length,
        contentTop: readRectTop(contentRoot),
        editorTop: readRectTop(editor),
        headingTop: readRectTop(heading),
        paragraphTop: readRectTop(paragraph),
        headerTop: header ? Math.round(header.getBoundingClientRect().top) : null,
        headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
      });

      frame += 1;
      if (frame < 90) {
        animationFrame = requestAnimationFrame(tick);
      }
    };

    globalWindow.__vlainaNoCoverLayoutProbe = {
      samples,
      stop: () => {
        stopped = true;
        cancelAnimationFrame(animationFrame);
        return samples;
      },
    };
    animationFrame = requestAnimationFrame(tick);
  });
}

async function stopNoCoverLayoutProbe(page: Page): Promise<LayoutSample[]> {
  return page.evaluate(() => {
    const probe = (window as typeof window & {
      __vlainaNoCoverLayoutProbe?: {
        stop: () => LayoutSample[];
      };
    }).__vlainaNoCoverLayoutProbe;
    return probe?.stop() ?? [];
  });
}

test.describe('notes no-cover open layout stability', () => {
  test('opens a no-cover markdown note without shifting visible content upward', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-no-cover-open-layout');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'No Cover Layout NotesRoot',
        files: [
          {
            filename: 'covered.md',
            content: [
              '---',
              'vlaina_cover: "assets/cover.svg" x=50 y=50 height=220 scale=1',
              '---',
              '',
              '# Covered Warmup',
              '',
              'Covered first paragraph sentinel.',
            ].join('\n'),
          },
          {
            filename: 'plain.md',
            content: [
              '# Plain No Cover',
              '',
              'No cover first paragraph sentinel.',
              '',
              'No cover second paragraph sentinel.',
            ].join('\n'),
          },
          {
            filename: 'assets/cover.svg',
            content: COVER_SVG,
          },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'No Cover Layout NotesRoot',
        minFileCount: 2,
      });

      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'covered' }).first().click();
      await expect(page.locator(NOTE_COVER_REGION_SELECTOR)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Covered Warmup', { timeout: 30_000 });

      await startNoCoverLayoutProbe(page);
      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'plain' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Plain No Cover', { timeout: 30_000 });
      await page.waitForTimeout(500);

      const samples = await stopNoCoverLayoutProbe(page);
      const visiblePlainSamples = samples.filter((sample) => sample.headingTop !== null);
      const headingTops = visiblePlainSamples.map((sample) => sample.headingTop!);
      const paragraphTops = visiblePlainSamples
        .map((sample) => sample.paragraphTop)
        .filter((top): top is number => top !== null);
      const minHeadingTop = Math.min(...headingTops);
      const maxHeadingTop = Math.max(...headingTops);
      const minParagraphTop = Math.min(...paragraphTops);
      const maxParagraphTop = Math.max(...paragraphTops);
      console.info('[notes-no-cover-layout]', {
        sampleCount: samples.length,
        visiblePlainSampleCount: visiblePlainSamples.length,
        headingDelta: maxHeadingTop - minHeadingTop,
        paragraphDelta: maxParagraphTop - minParagraphTop,
        firstHeadingTop: headingTops[0] ?? null,
        finalHeadingTop: headingTops[headingTops.length - 1] ?? null,
        firstParagraphTop: paragraphTops[0] ?? null,
        finalParagraphTop: paragraphTops[paragraphTops.length - 1] ?? null,
      });

      expect(visiblePlainSamples.length).toBeGreaterThan(2);
      expect(maxHeadingTop - minHeadingTop).toBeLessThanOrEqual(2);
      expect(maxParagraphTop - minParagraphTop).toBeLessThanOrEqual(2);

      const addCoverOverlay = page.locator(NOTE_COVER_ADD_OVERLAY_SELECTOR);
      await expect(addCoverOverlay).toBeVisible();
      await addCoverOverlay.click();
      await expect(page.locator(NOTE_COVER_REGION_SELECTOR)).toBeVisible();
      await expect(page.locator('[data-slot="popover-content"]')).toBeVisible();
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
