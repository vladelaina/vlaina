import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  NOTE_COVER_CROPPER_SELECTOR,
  NOTE_COVER_IMAGE_SELECTOR,
  NOTE_COVER_REGION_SELECTOR,
  cleanupIsolatedElectron,
  collectEditorDomMetrics,
  createVaultFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  measureRepeatedBlockScan,
  measureScrollFrames,
  openVaultInNotes,
  scrollNoteToTop,
  waitForEditorAnimationFrame,
} from './notesE2E';

const COVER_ASSET_PATH = 'assets/e2e-cover.svg';
const COVER_HEIGHT = 220;
const COVER_INITIAL_Y = 35;

const COVER_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">',
  '<defs>',
  '<linearGradient id="cover" x1="0" y1="0" x2="1" y2="1">',
  '<stop offset="0" stop-color="#1d4ed8"/>',
  '<stop offset="0.45" stop-color="#14b8a6"/>',
  '<stop offset="1" stop-color="#f59e0b"/>',
  '</linearGradient>',
  '</defs>',
  '<rect width="1200" height="400" fill="url(#cover)"/>',
  '<circle cx="950" cy="110" r="130" fill="#ffffff" opacity="0.22"/>',
  '<rect x="90" y="95" width="430" height="54" rx="18" fill="#ffffff" opacity="0.45"/>',
  '<rect x="90" y="185" width="650" height="32" rx="16" fill="#0f172a" opacity="0.30"/>',
  '<rect x="90" y="245" width="520" height="28" rx="14" fill="#ffffff" opacity="0.30"/>',
  '</svg>',
].join('');

type CoverFixture = {
  notePath: string;
  vaultPath: string;
};

type CoverFrontmatter = {
  assetPath: string | null;
  height: number | null;
  scale: number | null;
  x: number | null;
  y: number | null;
};

function createCoveredMarkdown(title: string, paragraphCount = 80): string {
  return [
    '---',
    `vlaina_cover: "${COVER_ASSET_PATH}"`,
    'vlaina_cover_x: 50',
    `vlaina_cover_y: ${COVER_INITIAL_Y}`,
    `vlaina_cover_height: ${COVER_HEIGHT}`,
    'vlaina_cover_scale: 1',
    '---',
    '',
    `# ${title}`,
    '',
    'Cover e2e sentinel paragraph near the top.',
    '',
    ...Array.from({ length: paragraphCount }, (_value, index) => (
      `Cover performance paragraph ${index + 1}: enough repeated text to make the editor scroll while the top cover remains stable.`
    )),
    '',
    'Final cover performance sentinel.',
  ].join('\n\n');
}

function parseCoverFrontmatter(markdown: string): CoverFrontmatter {
  const getString = (key: string) => {
    const match = new RegExp(`^${key}:\\s*"?([^"\\n]+)"?\\s*$`, 'm').exec(markdown);
    return match?.[1] ?? null;
  };
  const getNumber = (key: string) => {
    const value = Number(getString(key));
    return Number.isFinite(value) ? value : null;
  };

  return {
    assetPath: getString('vlaina_cover'),
    x: getNumber('vlaina_cover_x'),
    y: getNumber('vlaina_cover_y'),
    height: getNumber('vlaina_cover_height'),
    scale: getNumber('vlaina_cover_scale'),
  };
}

async function openCoverFixture(
  page: Page,
  input: {
    filename: string;
    title: string;
    paragraphCount?: number;
  },
): Promise<CoverFixture> {
  const fixture = await createVaultFilesFixture(page, {
    name: input.filename.replace(/\.md$/i, ''),
    files: [
      {
        filename: input.filename,
        content: createCoveredMarkdown(input.title, input.paragraphCount),
      },
      {
        filename: COVER_ASSET_PATH,
        content: COVER_SVG,
      },
    ],
  });

  await openVaultInNotes(page, {
    vaultPath: fixture.vaultPath,
    name: 'Cover E2E Vault',
    minFileCount: 1,
  });

  const openStartedAt = Date.now();
  await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: input.filename.replace(/\.md$/i, '') }).first().click();
  await expect(page.locator(EDITOR_SELECTOR)).toContainText(input.title, { timeout: 30_000 });
  console.info('[notes-cover-open]', {
    filename: input.filename,
    openWallMs: Date.now() - openStartedAt,
  });

  return {
    vaultPath: fixture.vaultPath,
    notePath: fixture.notePaths[0]!,
  };
}

async function waitForCoverReady(page: Page) {
  const startedAt = Date.now();
  await expect(page.locator(NOTE_COVER_REGION_SELECTOR)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(NOTE_COVER_CROPPER_SELECTOR)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(NOTE_COVER_IMAGE_SELECTOR)).toBeVisible({ timeout: 30_000 });

  await expect.poll(async () => page.evaluate(({ regionSelector, cropperSelector, imageSelector }) => {
    const region = document.querySelector<HTMLElement>(regionSelector);
    const cropper = document.querySelector<HTMLElement>(cropperSelector);
    const image = document.querySelector<HTMLImageElement>(imageSelector);
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
    const scrollRoot = editor?.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
    const regionRect = region?.getBoundingClientRect();
    const cropperRect = cropper?.getBoundingClientRect();
    const imageRect = image?.getBoundingClientRect();
    const editorRect = editor?.getBoundingClientRect();

    return {
      regionHeight: Math.round(regionRect?.height ?? 0),
      regionTop: Math.round(regionRect?.top ?? 0),
      regionBottom: Math.round(regionRect?.bottom ?? 0),
      cropperWidth: Math.round(cropperRect?.width ?? 0),
      cropperHeight: Math.round(cropperRect?.height ?? 0),
      imageWidth: Math.round(imageRect?.width ?? 0),
      imageHeight: Math.round(imageRect?.height ?? 0),
      naturalWidth: image?.naturalWidth ?? 0,
      naturalHeight: image?.naturalHeight ?? 0,
      imageSrcIsBlob: image?.src.startsWith('blob:') ?? false,
      imageTransform: image ? getComputedStyle(image).transform : '',
      objectFitMode: cropper?.dataset.objectFit ?? null,
      editorTop: Math.round(editorRect?.top ?? 0),
      scrollHeight: scrollRoot?.scrollHeight ?? 0,
      clientHeight: scrollRoot?.clientHeight ?? 0,
      sourceFallbackCount: document.querySelectorAll('[data-note-source-fallback="true"]').length,
    };
  }, {
    regionSelector: NOTE_COVER_REGION_SELECTOR,
    cropperSelector: NOTE_COVER_CROPPER_SELECTOR,
    imageSelector: NOTE_COVER_IMAGE_SELECTOR,
  }), { timeout: 30_000 }).toMatchObject({
    imageSrcIsBlob: true,
    naturalWidth: 1200,
    naturalHeight: 400,
    sourceFallbackCount: 0,
  });

  const finalMetrics = await page.evaluate(({ regionSelector, cropperSelector, imageSelector }) => {
    const region = document.querySelector<HTMLElement>(regionSelector)!;
    const cropper = document.querySelector<HTMLElement>(cropperSelector)!;
    const image = document.querySelector<HTMLImageElement>(imageSelector)!;
    const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror')!;
    const scrollRoot = editor.closest('[data-note-scroll-root="true"]') as HTMLElement | null;
    const regionRect = region.getBoundingClientRect();
    const cropperRect = cropper.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();

    return {
      regionHeight: Math.round(regionRect.height),
      regionTop: Math.round(regionRect.top),
      regionBottom: Math.round(regionRect.bottom),
      cropperWidth: Math.round(cropperRect.width),
      cropperHeight: Math.round(cropperRect.height),
      imageWidth: Math.round(imageRect.width),
      imageHeight: Math.round(imageRect.height),
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      imageSrcIsBlob: image.src.startsWith('blob:'),
      imageTransform: getComputedStyle(image).transform,
      objectFitMode: cropper.dataset.objectFit ?? null,
      editorTop: Math.round(editorRect.top),
      scrollHeight: scrollRoot?.scrollHeight ?? 0,
      clientHeight: scrollRoot?.clientHeight ?? 0,
      sourceFallbackCount: document.querySelectorAll('[data-note-source-fallback="true"]').length,
    };
  }, {
    regionSelector: NOTE_COVER_REGION_SELECTOR,
    cropperSelector: NOTE_COVER_CROPPER_SELECTOR,
    imageSelector: NOTE_COVER_IMAGE_SELECTOR,
  });

  console.info('[notes-cover-ready]', {
    ...finalMetrics,
    readyWallMs: Date.now() - startedAt,
  });

  return finalMetrics;
}

async function readCoverFrontmatter(page: Page, notePath: string): Promise<CoverFrontmatter> {
  const markdown = await page.evaluate((pathToRead) => (window as any).__vlainaE2E.readTextFile(pathToRead), notePath);
  return parseCoverFrontmatter(markdown);
}

async function expectCoverFrontmatter(
  page: Page,
  notePath: string,
  predicate: (frontmatter: CoverFrontmatter) => boolean,
): Promise<CoverFrontmatter> {
  let lastValue: CoverFrontmatter = {
    assetPath: null,
    x: null,
    y: null,
    height: null,
    scale: null,
  };
  await expect.poll(async () => {
    lastValue = await readCoverFrontmatter(page, notePath);
    return predicate(lastValue);
  }, { timeout: 10_000 }).toBe(true);
  return lastValue;
}

async function clickCoverCenter(page: Page) {
  const box = await page.locator(NOTE_COVER_CROPPER_SELECTOR).boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

test.describe('notes top cover e2e coverage', () => {
  test.setTimeout(120_000);

  test('renders a frontmatter cover at the top, opens the picker, and removes it cleanly', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-cover-functional');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
        console.info(`[notes-cover-functional:pageerror] ${error.message}`);
      });
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:')) {
          console.info(text);
        }
      });

      const { notePath } = await openCoverFixture(page, {
        filename: 'cover-functional.md',
        title: 'Cover Functional E2E',
      });
      const coverMetrics = await waitForCoverReady(page);

      expect(coverMetrics.regionHeight).toBe(COVER_HEIGHT);
      expect(coverMetrics.cropperHeight).toBeGreaterThanOrEqual(COVER_HEIGHT - 2);
      expect(coverMetrics.cropperWidth).toBeGreaterThan(700);
      expect(coverMetrics.regionTop).toBeLessThan(coverMetrics.editorTop);
      expect(coverMetrics.regionBottom).toBeLessThan(coverMetrics.editorTop);
      expect(coverMetrics.objectFitMode).toBe('horizontal-cover');
      expect(coverMetrics.imageTransform).toContain('matrix');
      expect(coverMetrics.scrollHeight).toBeGreaterThan(coverMetrics.clientHeight);

      const initialFrontmatter = await readCoverFrontmatter(page, notePath);
      expect(initialFrontmatter).toMatchObject({
        assetPath: COVER_ASSET_PATH,
        height: COVER_HEIGHT,
        scale: 1,
        x: 50,
        y: COVER_INITIAL_Y,
      });

      await clickCoverCenter(page);
      const removeButton = page.getByRole('button', { name: /^(Remove|移除)$/ });
      await expect(removeButton).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: /^(Library|图库|圖庫)$/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /^(Upload|上传|上傳)$/ })).toBeVisible();

      await removeButton.click();
      await expect(page.locator(NOTE_COVER_REGION_SELECTOR)).toHaveCount(0, { timeout: 10_000 });
      await expectCoverFrontmatter(page, notePath, (frontmatter) => frontmatter.assetPath === null);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Final cover performance sentinel');
      expect(pageErrors).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('persists cover drag and resize while keeping editor performance bounded', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-cover-performance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1360, height: 900 });
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
        console.info(`[notes-cover-performance:pageerror] ${error.message}`);
      });
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:')) {
          console.info(text);
        }
      });

      const { notePath } = await openCoverFixture(page, {
        filename: 'cover-performance.md',
        title: 'Cover Performance E2E',
        paragraphCount: 180,
      });
      const coverReadyStartedAt = Date.now();
      const coverMetrics = await waitForCoverReady(page);
      const coverReadyMs = Date.now() - coverReadyStartedAt;
      const domMetrics = await collectEditorDomMetrics(page);
      const blockScanMetrics = await measureRepeatedBlockScan(page, 30);
      const scrollMetrics = await measureScrollFrames(page, 60);

      console.info('[notes-cover-performance-open]', {
        coverReadyMs,
        coverMetrics,
        domMetrics,
        blockScanMetrics,
        scrollMetrics,
      });

      expect(coverReadyMs).toBeLessThan(10_000);
      expect(domMetrics.countsBySelector.sourceFallback).toBe(0);
      expect(domMetrics.selectableBlockCount).toBeGreaterThan(100);
      expect(blockScanMetrics.p95Ms).toBeLessThan(250);
      expect(scrollMetrics).not.toBeNull();
      expect(scrollMetrics!.maxFrameMs).toBeLessThan(1_500);
      expect(scrollMetrics!.finalScrollTop).toBeGreaterThan(0);

      await scrollNoteToTop(page);
      await waitForEditorAnimationFrame(page);

      const beforeDrag = await readCoverFrontmatter(page, notePath);
      expect(beforeDrag.y).toBe(COVER_INITIAL_Y);
      const dragBox = await page.locator(NOTE_COVER_CROPPER_SELECTOR).boundingBox();
      expect(dragBox).not.toBeNull();
      const dragStartX = dragBox!.x + dragBox!.width / 2;
      const dragStartY = dragBox!.y + dragBox!.height / 2;
      const dragStartedAt = Date.now();
      await page.mouse.move(dragStartX, dragStartY);
      await page.mouse.down();
      await page.mouse.move(dragStartX, dragStartY + 72, { steps: 8 });
      await page.mouse.up();
      const dragWallMs = Date.now() - dragStartedAt;

      const afterDrag = await expectCoverFrontmatter(
        page,
        notePath,
        (frontmatter) => (
          frontmatter.assetPath === COVER_ASSET_PATH &&
          frontmatter.y !== null &&
          Math.abs(frontmatter.y - COVER_INITIAL_Y) >= 1
        ),
      );
      expect(afterDrag.height).toBe(COVER_HEIGHT);

      const regionBox = await page.locator(NOTE_COVER_REGION_SELECTOR).boundingBox();
      expect(regionBox).not.toBeNull();
      const resizeStartedAt = Date.now();
      await page.mouse.move(regionBox!.x + regionBox!.width / 2, regionBox!.y + regionBox!.height - 2);
      await page.mouse.down();
      await page.mouse.move(regionBox!.x + regionBox!.width / 2, regionBox!.y + regionBox!.height + 54, { steps: 8 });
      await page.mouse.up();
      const resizeWallMs = Date.now() - resizeStartedAt;

      const afterResize = await expectCoverFrontmatter(
        page,
        notePath,
        (frontmatter) => (
          frontmatter.assetPath === COVER_ASSET_PATH &&
          frontmatter.height !== null &&
          frontmatter.height > COVER_HEIGHT
        ),
      );
      await expect(page.locator(NOTE_COVER_REGION_SELECTOR)).toBeVisible();
      let resizedHeight = 0;
      await expect.poll(async () => {
        resizedHeight = await page.locator(NOTE_COVER_REGION_SELECTOR).evaluate((element) =>
          Math.round(element.getBoundingClientRect().height)
        );
        return Math.abs(resizedHeight - (afterResize.height ?? 0));
      }, { timeout: 10_000 }).toBeLessThanOrEqual(1);

      console.info('[notes-cover-performance-interactions]', {
        dragWallMs,
        resizeWallMs,
        beforeDrag,
        afterDrag,
        afterResize,
        resizedHeight,
      });

      expect(dragWallMs).toBeLessThan(5_000);
      expect(resizeWallMs).toBeLessThan(5_000);
      expect(afterResize.scale).toBeGreaterThan(0);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Final cover performance sentinel');
      expect(pageErrors).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
