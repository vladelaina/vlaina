import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  NOTE_IMAGE_BLOCK_SELECTOR,
  NOTE_IMAGE_CROPPER_TOOLBAR_SELECTOR,
  NOTE_IMAGE_TOOLBAR_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  clearSelectedNoteBlocks,
  collectEditorDomMetrics,
  getBlankAreaDragTarget,
  getOpenBridgePages,
  launchIsolatedElectron,
  measureRepeatedBlockScan,
  openMarkdownFixture,
  selectNoteBlocksByText,
} from './notesE2E';

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const GITHUB_RAW_COVER_IMAGE_SRC =
  'https://raw.githubusercontent.com/521xueweihan/img_logo/master/logo/cover.jpg#w=72%25';

function createImageBlockMarkdown(): string {
  return [
    '# E2E Notes Image Block',
    '',
    'Paragraph before image sentinel for block selection.',
    '',
    `![Notes image block alt sentinel](${TINY_PNG_DATA_URL} "Notes image block title")`,
    '',
    'Paragraph after image sentinel for drag selection.',
    '',
    '- Image block list item alpha',
    '- Image block list item beta',
    '',
    'Final image block sentinel.',
    '',
  ].join('\n');
}

function createRemoteCoverImageMarkdown(): string {
  return [
    '# E2E Remote Cover Image Copy',
    '',
    'Paragraph before remote cover image.',
    '',
    `<img src="${GITHUB_RAW_COVER_IMAGE_SRC}" alt="cover" width="72%" data-vlaina-crop="37.891280,36.646501,35.700407,35.697249,2.349414" />`,
    '',
    'Paragraph after remote cover image.',
    '',
  ].join('\n');
}

async function getImageBlockDiagnostics(page: Page) {
  return page.evaluate(() => {
    const block = document.querySelector<HTMLElement>('.milkdown .ProseMirror .image-block-container');
    const image = block?.querySelector<HTMLImageElement>('img');
    const toolbar = block?.querySelector<HTMLElement>('.image-toolbar');
    const cropperToolbar = block?.querySelector<HTMLElement>('.image-cropper-toolbar');
    const blockRect = block?.getBoundingClientRect();
    const imageRect = image?.getBoundingClientRect();
    const toolbarStyle = toolbar ? window.getComputedStyle(toolbar) : null;
    const cropperToolbarStyle = cropperToolbar ? window.getComputedStyle(cropperToolbar) : null;

    return {
      hasBlock: Boolean(block),
      blockWidth: Math.round(blockRect?.width ?? 0),
      blockHeight: Math.round(blockRect?.height ?? 0),
      hasImage: Boolean(image),
      imageComplete: image?.complete ?? false,
      imageWidth: Math.round(imageRect?.width ?? 0),
      imageHeight: Math.round(imageRect?.height ?? 0),
      imageSrc: image?.getAttribute('src') ?? '',
      toolbarButtonCount: toolbar?.querySelectorAll('button').length ?? 0,
      toolbarOpacity: toolbarStyle?.opacity ?? null,
      toolbarPointerEvents: toolbarStyle?.pointerEvents ?? null,
      cropperToolbarButtonCount: cropperToolbar?.querySelectorAll('button').length ?? 0,
      cropperToolbarOpacity: cropperToolbarStyle?.opacity ?? null,
      cropperToolbarPointerEvents: cropperToolbarStyle?.pointerEvents ?? null,
      cropperImageCount: block?.querySelectorAll('.reactEasyCrop_Image').length ?? 0,
      sourceFallbackCount: document.querySelectorAll('[data-note-source-fallback="true"]').length,
      selectedCount: document.querySelectorAll('.milkdown .ProseMirror .editor-block-selected').length,
    };
  });
}

async function waitForToolbarInteractive(page: Page) {
  await expect.poll(async () => {
    const diagnostics = await getImageBlockDiagnostics(page);
    return {
      buttonCount: diagnostics.toolbarButtonCount,
      pointerEvents: diagnostics.toolbarPointerEvents,
      opacity: Number(diagnostics.toolbarOpacity ?? 0),
    };
  }, { timeout: 10_000 }).toMatchObject({
    buttonCount: expect.any(Number),
    pointerEvents: 'auto',
    opacity: 1,
  });
}

async function waitForCropperToolbarInteractive(page: Page) {
  await expect.poll(async () => {
    const diagnostics = await getImageBlockDiagnostics(page);
    return {
      buttonCount: diagnostics.cropperToolbarButtonCount,
      pointerEvents: diagnostics.cropperToolbarPointerEvents,
      opacity: Number(diagnostics.cropperToolbarOpacity ?? 0),
    };
  }, { timeout: 10_000 }).toMatchObject({
    buttonCount: expect.any(Number),
    pointerEvents: 'auto',
    opacity: 1,
  });
}

test.describe('notes image block interaction', () => {
  test.setTimeout(120_000);

  test('copies a remote HTML image with presentation fragment as an image', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-remote-image-copy');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await openMarkdownFixture(page, {
        filename: 'notes-remote-cover-copy.md',
        content: createRemoteCoverImageMarkdown(),
      });

      const imageBlock = page.locator(NOTE_IMAGE_BLOCK_SELECTOR).first();
      await expect(imageBlock).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => getImageBlockDiagnostics(page), { timeout: 30_000 }).toMatchObject({
        hasBlock: true,
        hasImage: true,
        imageComplete: true,
        sourceFallbackCount: 0,
      });

      await imageBlock.hover();
      await waitForToolbarInteractive(page);
      await page.locator(`${NOTE_IMAGE_TOOLBAR_SELECTOR} [data-image-toolbar-action="copy"]`).click();

      await expect.poll(async () => app.evaluate(({ clipboard }) => {
        const image = clipboard.readImage();
        return image.isEmpty() ? null : image.getSize();
      }), {
        timeout: 10_000,
        message: 'Expected remote cover copy to place an image on the desktop clipboard',
      }).toMatchObject({
        width: expect.any(Number),
        height: expect.any(Number),
      });

      await app.evaluate(({ clipboard }) => {
        clipboard.clear();
      });
      await imageBlock.locator('img').dispatchEvent('click');
      const viewer = page.locator('[role="dialog"][data-chat-image-viewer-surface="true"]');
      await expect(viewer).toBeVisible({ timeout: 10_000 });
      await viewer.locator('[data-action="copy"]').click();

      await expect.poll(async () => app.evaluate(({ clipboard }) => {
        const image = clipboard.readImage();
        return image.isEmpty() ? null : image.getSize();
      }), {
        timeout: 10_000,
        message: 'Expected remote cover viewer copy to place an image on the desktop clipboard',
      }).toMatchObject({
        width: expect.any(Number),
        height: expect.any(Number),
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('renders image blocks, opens crop controls, and keeps block selection usable', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-image-block-interaction');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const opened = await openMarkdownFixture(page, {
        filename: 'notes-image-block-e2e.md',
        content: createImageBlockMarkdown(),
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Paragraph before image sentinel', {
        timeout: 30_000,
      });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Paragraph after image sentinel');
      const imageBlock = page.locator(NOTE_IMAGE_BLOCK_SELECTOR).first();
      await expect(imageBlock).toBeVisible({ timeout: 30_000 });

      await expect.poll(() => getImageBlockDiagnostics(page), { timeout: 30_000 }).toMatchObject({
        hasBlock: true,
        hasImage: true,
        imageComplete: true,
        sourceFallbackCount: 0,
      });

      const initialDiagnostics = await getImageBlockDiagnostics(page);
      const initialDomMetrics = await collectEditorDomMetrics(page);
      expect(initialDiagnostics.blockWidth).toBeGreaterThan(0);
      expect(initialDiagnostics.blockHeight).toBeGreaterThan(0);
      expect(initialDiagnostics.imageSrc).toContain(TINY_PNG_DATA_URL);
      expect(initialDiagnostics.toolbarButtonCount).toBeGreaterThanOrEqual(7);
      expect(initialDiagnostics.cropperImageCount).toBeGreaterThanOrEqual(1);
      expect(initialDomMetrics.countsBySelector.images).toBeGreaterThanOrEqual(1);
      expect(initialDomMetrics.countsBySelector.sourceFallback).toBe(0);

      await imageBlock.hover();
      await waitForToolbarInteractive(page);

      const cropOpenStartedAt = Date.now();
      await page.locator(`${NOTE_IMAGE_TOOLBAR_SELECTOR} button`).nth(3).click();
      await waitForCropperToolbarInteractive(page);
      const cropOpenMs = Date.now() - cropOpenStartedAt;

      const cropperDiagnostics = await getImageBlockDiagnostics(page);
      expect(cropperDiagnostics.cropperToolbarButtonCount).toBeGreaterThanOrEqual(2);
      expect(cropperDiagnostics.cropperImageCount).toBeGreaterThanOrEqual(1);

      await page.locator(`${NOTE_IMAGE_CROPPER_TOOLBAR_SELECTOR} button`).first().click();
      await expect.poll(async () => {
        const diagnostics = await getImageBlockDiagnostics(page);
        return diagnostics.cropperToolbarPointerEvents;
      }, { timeout: 10_000 }).toBe('none');

      const selectedCount = await selectNoteBlocksByText(page, [
        'Paragraph before image sentinel',
        'Paragraph after image sentinel',
        'Final image block sentinel',
      ]);
      expect(selectedCount).toBe(3);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(3);

      const blockScanMetrics = await measureRepeatedBlockScan(page, 16);
      expect(blockScanMetrics.blockCount).toBeGreaterThanOrEqual(6);
      expect(blockScanMetrics.p95Ms).toBeLessThan(250);

      await clearSelectedNoteBlocks(page);
      const dragTarget = await getBlankAreaDragTarget(page, 'Paragraph after image sentinel');
      expect(dragTarget).not.toBeNull();

      const dragStartedAt = Date.now();
      await page.mouse.move(dragTarget!.startX, dragTarget!.startY);
      await page.mouse.down();
      await page.mouse.move(dragTarget!.endX, dragTarget!.endY, { steps: 8 });
      await page.mouse.up();
      const dragMs = Date.now() - dragStartedAt;

      await expect(page.locator(SELECTED_BLOCK_SELECTOR).first()).toBeVisible({ timeout: 10_000 });
      const finalDiagnostics = await getImageBlockDiagnostics(page);
      expect(finalDiagnostics.selectedCount).toBeGreaterThan(0);
      expect(finalDiagnostics.sourceFallbackCount).toBe(0);

      console.info('[notes-image-block-interaction]', {
        opened,
        initialDiagnostics,
        cropOpenMs,
        blockScanMetrics,
        dragMs,
        finalDiagnostics,
      });

      expect(cropOpenMs).toBeLessThan(5_000);
      expect(dragMs).toBeLessThan(5_000);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
