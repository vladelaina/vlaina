import { expect, type Page } from '@playwright/test';
import { EDITOR_SELECTOR } from './notesE2E';
import type { DragVisualGeometry } from './notesBlockSelectionTypes';

export async function dragVisibleHandleAndMeasure(page: Page, label: string): Promise<DragVisualGeometry> {
  const handleBox = await page.locator('.editor-block-control-handle').boundingBox();
  if (!handleBox) {
    throw new Error(`${label}: could not resolve block drag handle geometry`);
  }

  const dragStartX = handleBox.x + handleBox.width / 2;
  const dragStartY = handleBox.y + handleBox.height / 2;
  let mouseIsDown = false;

  try {
    await page.mouse.move(dragStartX, dragStartY);
    await page.mouse.down();
    mouseIsDown = true;
    await page.mouse.move(dragStartX + 28, dragStartY, { steps: 4 });

    await expect.poll(async () => page.evaluate(() =>
      document.body.classList.contains('editor-block-drag-active')
    ), { message: `${label}: drag session should become active` }).toBe(true);

    const visual = await page.evaluate((editorSelector) => {
      const probe = document.createElement('span');
      probe.style.backgroundColor = 'var(--vlaina-block-selection-color-default)';
      document.body.appendChild(probe);
      const expectedBackground = getComputedStyle(probe).backgroundColor;
      probe.remove();

      const source = document.querySelector<HTMLElement>(
        `${editorSelector} .editor-block-drag-source, ${editorSelector} .editor-block-selected`
      );
      const sourceStyle = source ? getComputedStyle(source) : null;
      const sourceAfterStyle = source ? getComputedStyle(source, '::after') : null;
      const sourceAfterLeft = sourceAfterStyle ? Number.parseFloat(sourceAfterStyle.left) : Number.NaN;
      const sourceAfterRight = sourceAfterStyle ? Number.parseFloat(sourceAfterStyle.right) : Number.NaN;
      const sourceBleedStart = sourceStyle
        ? Number.parseFloat(sourceStyle.getPropertyValue('--vlaina-block-selection-bleed-x-start'))
        : Number.NaN;
      const sourceBleedEnd = sourceStyle
        ? Number.parseFloat(sourceStyle.getPropertyValue('--vlaina-block-selection-bleed-x-end'))
        : Number.NaN;
      const preview = document.querySelector<HTMLElement>('.editor-block-drag-preview');
      const previewLayer = preview?.querySelector<HTMLElement>('.editor-block-drag-preview-layer') ?? null;
      const previewStyle = preview ? getComputedStyle(preview) : null;
      const previewLayerStyle = previewLayer ? getComputedStyle(previewLayer) : null;
      const previewRect = preview?.getBoundingClientRect() ?? null;
      const controls = document.querySelector<HTMLElement>('.editor-block-controls.dragging, .editor-block-controls.visible');
      const controlsBeforeStyle = controls ? getComputedStyle(controls, '::before') : null;

      return {
        dragActive: document.body.classList.contains('editor-block-drag-active'),
        controlsDragging: controls?.classList.contains('dragging') ?? false,
        sourceCount: document.querySelectorAll(`${editorSelector} .editor-block-drag-source`).length,
        selectedCount: document.querySelectorAll(`${editorSelector} .editor-block-selected`).length,
        sourceBackgroundColor: sourceStyle?.backgroundColor ?? null,
        sourceBoxShadow: sourceStyle?.boxShadow ?? null,
        sourceOpacity: sourceStyle?.opacity ?? null,
        sourceAfterBackgroundColor: sourceAfterStyle?.backgroundColor ?? null,
        sourceAfterLeft: Number.isFinite(sourceAfterLeft) ? sourceAfterLeft : null,
        sourceAfterRight: Number.isFinite(sourceAfterRight) ? sourceAfterRight : null,
        sourceBleedStart: Number.isFinite(sourceBleedStart) ? sourceBleedStart : null,
        sourceBleedEnd: Number.isFinite(sourceBleedEnd) ? sourceBleedEnd : null,
        expectedBackground,
        previewExists: preview !== null,
        previewWidth: previewRect ? Math.round(previewRect.width * 10) / 10 : null,
        previewHeight: previewRect ? Math.round(previewRect.height * 10) / 10 : null,
        previewBackgroundColor: previewStyle?.backgroundColor ?? null,
        previewOpacity: previewStyle?.opacity ?? null,
        previewBoxShadow: previewStyle?.boxShadow ?? null,
        previewLayerBackgroundColor: previewLayerStyle?.backgroundColor ?? null,
        previewLayerOpacity: previewLayerStyle?.opacity ?? null,
        previewLayerBoxShadow: previewLayerStyle?.boxShadow ?? null,
        controlsBeforeBackgroundColor: controlsBeforeStyle?.backgroundColor ?? null,
      };
    }, EDITOR_SELECTOR);

    await page.mouse.move(dragStartX, dragStartY, { steps: 2 });
    return visual;
  } finally {
    if (mouseIsDown) {
      await page.mouse.up().catch(() => undefined);
    }
    await page.mouse.move(8, 8).catch(() => undefined);
    await expect.poll(async () => page.evaluate(() =>
      document.body.classList.contains('editor-block-drag-active')
    ), { message: `${label}: drag session should stop after mouse up` }).toBe(false);
  }
}

export function expectTransparentDragVisual(label: string, visual: DragVisualGeometry): void {
  expect(visual.dragActive, `${label}: drag active`).toBe(true);
  expect(visual.controlsDragging, `${label}: controls dragging class`).toBe(true);
  expect(visual.selectedCount + visual.sourceCount, `${label}: selected/source count`).toBeGreaterThan(0);
  expectDragSourceSelectionSurface(label, visual);
  expect(visual.sourceOpacity, `${label}: source opacity`).toBe('1');
  expect(visual.previewExists, `${label}: preview should exist`).toBe(true);
  expect(visual.previewWidth ?? 0, `${label}: preview width`).toBeGreaterThan(0);
  expect(visual.previewHeight ?? 0, `${label}: preview height`).toBeGreaterThan(0);
  expect(visual.previewBackgroundColor, `${label}: preview background`).toBe('rgba(0, 0, 0, 0)');
  expect(visual.previewOpacity, `${label}: preview opacity`).toBe('1');
  expect(visual.previewBoxShadow, `${label}: preview shadow`).toBe('none');
  expect(visual.previewLayerBackgroundColor, `${label}: preview layer background`).toBe('rgba(0, 0, 0, 0)');
  expect(visual.previewLayerOpacity, `${label}: preview layer opacity`).toBe('1');
  expect(visual.previewLayerBoxShadow, `${label}: preview layer shadow`).toBe('none');
  expect(visual.controlsBeforeBackgroundColor, `${label}: handle pseudo background`).toBe('rgba(0, 0, 0, 0)');
}

export function expectDragSourceSelectionSurface(
  label: string,
  visual: Pick<DragVisualGeometry,
    | 'sourceBackgroundColor'
    | 'sourceBoxShadow'
    | 'sourceAfterBackgroundColor'
    | 'sourceAfterLeft'
    | 'sourceAfterRight'
    | 'sourceBleedStart'
    | 'sourceBleedEnd'
    | 'expectedBackground'
  >,
): void {
  if (visual.sourceBackgroundColor === visual.expectedBackground) {
    return;
  }

  expect(visual.sourceBackgroundColor, `${label}: text source element background`).toBe('rgba(0, 0, 0, 0)');
  expect(visual.sourceBoxShadow, `${label}: text source element shadow`).toBe('none');
  expect(visual.sourceAfterBackgroundColor, `${label}: source selection pseudo background`).toBe(visual.expectedBackground);
  expect(visual.sourceAfterLeft, `${label}: source selection pseudo left`).not.toBeNull();
  expect(visual.sourceAfterRight, `${label}: source selection pseudo right`).not.toBeNull();
  expect(visual.sourceBleedStart, `${label}: source bleed start`).not.toBeNull();
  expect(visual.sourceBleedEnd, `${label}: source bleed end`).not.toBeNull();
  expect(visual.sourceAfterLeft!, `${label}: source pseudo should preserve left bleed`)
    .toBeCloseTo(-visual.sourceBleedStart!, 0);
  expect(visual.sourceAfterRight!, `${label}: source pseudo should preserve right bleed`)
    .toBeCloseTo(-visual.sourceBleedEnd!, 0);
}
