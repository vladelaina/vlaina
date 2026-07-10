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
  coverRegionHeight: number | null;
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
      const coverRegion = document.querySelector<HTMLElement>('[data-note-cover-region="true"]');
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
        coverRegionHeight: coverRegion ? Math.round(coverRegion.getBoundingClientRect().height) : null,
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
      await startNoCoverLayoutProbe(page);
      await addCoverOverlay.click();
      await expect(page.locator('[data-slot="popover-content"]')).toBeVisible();
      const pickerPlacement = await page.evaluate(() => {
        const overlay = document.querySelector<HTMLElement>('[data-note-cover-add-overlay="true"]');
        const popover = document.querySelector<HTMLElement>('[data-slot="popover-content"]');
        const overlayRect = overlay?.getBoundingClientRect();
        const popoverRect = popover?.getBoundingClientRect();

        return overlayRect && popoverRect
          ? {
            overlayBottom: Math.round(overlayRect.bottom),
            overlayRight: Math.round(overlayRect.right),
            popoverTop: Math.round(popoverRect.top),
            popoverRight: Math.round(popoverRect.right),
          }
          : null;
      });
      expect(pickerPlacement, JSON.stringify(pickerPlacement, null, 2)).not.toBeNull();
      expect(pickerPlacement!.popoverTop, JSON.stringify(pickerPlacement, null, 2))
        .toBeGreaterThanOrEqual(pickerPlacement!.overlayBottom);
      expect(Math.abs(pickerPlacement!.popoverRight - pickerPlacement!.overlayRight), JSON.stringify(pickerPlacement, null, 2))
        .toBeLessThanOrEqual(24);
      await page.waitForTimeout(500);

      const addCoverSamples = await stopNoCoverLayoutProbe(page);
      const addCoverVisibleSamples = addCoverSamples.filter((sample) => sample.headingTop !== null);
      const addCoverHeadingTops = addCoverVisibleSamples.map((sample) => sample.headingTop!);
      const addCoverParagraphTops = addCoverVisibleSamples
        .map((sample) => sample.paragraphTop)
        .filter((top): top is number => top !== null);
      const addCoverRegionHeights = addCoverSamples
        .map((sample) => sample.coverRegionHeight)
        .filter((height): height is number => height !== null);
      const addCoverMaxRegionHeight = Math.max(0, ...addCoverRegionHeights);
      const addCoverHeadingDelta = Math.max(...addCoverHeadingTops) - Math.min(...addCoverHeadingTops);
      const addCoverParagraphDelta = Math.max(...addCoverParagraphTops) - Math.min(...addCoverParagraphTops);

      console.info('[notes-no-cover-add-layout]', {
        sampleCount: addCoverSamples.length,
        visiblePlainSampleCount: addCoverVisibleSamples.length,
        headingDelta: addCoverHeadingDelta,
        paragraphDelta: addCoverParagraphDelta,
        maxCoverRegionHeight: addCoverMaxRegionHeight,
      });

      expect(addCoverVisibleSamples.length).toBeGreaterThan(2);
      expect(addCoverHeadingDelta).toBeLessThanOrEqual(2);
      expect(addCoverParagraphDelta).toBeLessThanOrEqual(2);
      expect(addCoverMaxRegionHeight).toBeLessThanOrEqual(1);

      const coverAssetItem = page.locator('[data-filename="./assets/cover.svg"]').first();
      await expect(coverAssetItem).toBeVisible({ timeout: 10_000 });
      const coverAssetBox = await coverAssetItem.boundingBox();
      expect(coverAssetBox).not.toBeNull();
      await page.mouse.move(
        coverAssetBox!.x + coverAssetBox!.width / 2,
        coverAssetBox!.y + coverAssetBox!.height / 2,
      );
      await expect(page.locator(`${NOTE_COVER_REGION_SELECTOR} img`).first()).toBeVisible({ timeout: 10_000 });
      const previewHeight = await page.locator(NOTE_COVER_REGION_SELECTOR).evaluate((element) =>
        Math.round(element.getBoundingClientRect().height)
      );
      expect(previewHeight).toBeGreaterThan(0);

      await startNoCoverLayoutProbe(page);
      const popoverBox = await page.locator('[data-slot="popover-content"]').boundingBox();
      expect(popoverBox).not.toBeNull();
      await page.mouse.move(popoverBox!.x + 12, popoverBox!.y + 12);
      await page.waitForTimeout(350);
      const previewLeaveSamples = await stopNoCoverLayoutProbe(page);
      const previewHeights = previewLeaveSamples
        .map((sample) => sample.coverRegionHeight)
        .filter((height): height is number => height !== null);
      const minPreviewHeight = previewHeights.length ? Math.min(...previewHeights) : 0;

      console.info('[notes-no-cover-preview-leave-layout]', {
        sampleCount: previewLeaveSamples.length,
        previewHeight,
        minPreviewHeight,
      });

      expect(previewHeights.length).toBeGreaterThan(2);
      expect(minPreviewHeight).toBeGreaterThanOrEqual(previewHeight - 1);

      const readCoverFrame = () => page.locator(`${NOTE_COVER_REGION_SELECTOR} img`).first().evaluate((image) => {
        const rect = image.getBoundingClientRect();
        const regionRect = image.closest('[data-note-cover-region="true"]')?.getBoundingClientRect();
        return { src: (image as HTMLImageElement).src, x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), regionWidth: Math.round(regionRect?.width ?? 0), regionHeight: Math.round(regionRect?.height ?? 0) };
      });
      const previewFrame = await readCoverFrame();
      const heading = page.locator('.milkdown .ProseMirror h1', { hasText: 'Plain No Cover' }).first();
      const previewHeadingTop = await heading.evaluate((element) => Math.round(element.getBoundingClientRect().top));
      await coverAssetItem.click();
      await expect(page.locator('[data-slot="popover-content"]')).toBeHidden();
      expect(await readCoverFrame()).toEqual(previewFrame);
      const appliedHeadingTop = await heading.evaluate((element) => Math.round(element.getBoundingClientRect().top));
      expect(Math.abs(appliedHeadingTop - previewHeadingTop)).toBeLessThanOrEqual(2);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
