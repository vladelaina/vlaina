import { expect, test } from "@playwright/test";
import {
  BLOCK_CONTROLS_SELECTOR,
  EDITOR_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from "./notesE2E";
import { expectDragSourceSelectionSurface, measureSelectedSurfaceCoverage } from "./notesBlockSelectionDragHelpers";
import {
  openBlockSelectionFixture,
  expectSelectedParagraphs,
  selectNoteBlocksByMatchers,
  moveMouseToBlockHandleGutter,
  measureCollapseToggleClearance,
} from "./notesBlockSelectionShared";

test.describe("notes block selection", () => {
  test.setTimeout(90_000);

  test('selects blocks from the text gutter and centers the drag handle on the selected block', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openBlockSelectionFixture(page);

      await expect.poll(async () => page.evaluate(() => (window as any).__vlainaE2E.getNoteSelectableBlocks()))
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ tagName: 'P', text: 'First selectable paragraph' }),
          expect.objectContaining({ tagName: 'P', text: 'Second selectable paragraph' }),
        ]));

      await expect(
        page.evaluate(() => (window as any).__vlainaE2E.selectNoteBlocksByText([
          'First selectable paragraph',
          'Second selectable paragraph',
        ]))
      ).resolves.toBe(2);
      await expectSelectedParagraphs(page, ['First selectable paragraph', 'Second selectable paragraph']);

      const firstSelected = page.locator(SELECTED_BLOCK_SELECTOR).first();
      const selectedRect = await firstSelected.boundingBox();
      if (!selectedRect) {
        throw new Error('Could not resolve selected block geometry');
      }

      await page.mouse.move(Math.max(8, selectedRect.x - 18), selectedRect.y + selectedRect.height / 2);
      await expect(page.locator(BLOCK_CONTROLS_SELECTOR)).toBeVisible();

      const geometry = await page.evaluate(() => {
        const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible');
        const selected = document.querySelector<HTMLElement>('.milkdown .ProseMirror .editor-block-selected');
        if (!controls || !selected) return null;
        const controlsRect = controls.getBoundingClientRect();
        const selectedRect = selected.getBoundingClientRect();
        return {
          controlsCenterY: controlsRect.top + controlsRect.height / 2,
          selectedCenterY: selectedRect.top + selectedRect.height / 2,
          controlsLeft: controlsRect.left,
          selectedLeft: selectedRect.left,
        };
      });

      expect(geometry).not.toBeNull();
      expect(Math.abs(geometry!.controlsCenterY - geometry!.selectedCenterY)).toBeLessThanOrEqual(2);
      expect(geometry!.controlsLeft).toBeLessThan(geometry!.selectedLeft);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps block handles clear of collapse toggles while dragging', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-handle-collapse-clearance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const { notePath } = await page.evaluate(() =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'block-handle-collapse-clearance.md',
          content: [
            '# Collapsible Heading Clearance',
            '',
            'Heading body paragraph',
            '',
            '# List Collapse Section',
            '',
            '- Parent collapse row',
            '  - Child collapse row',
            '',
          ].join('\n'),
        })
      );

      await page.evaluate((pathToOpen) => (window as any).__vlainaE2E.openAbsoluteNote(pathToOpen), notePath);
      await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .heading-toggle-btn`).first()).toBeAttached();
      await expect(page.locator(`${EDITOR_SELECTOR} .editor-collapse-btn[data-has-content="true"]`).first()).toBeAttached();

      await selectNoteBlocksByMatchers(page, [{ exact: 'Collapsible Heading Clearance' }]);
      await moveMouseToBlockHandleGutter(
        page,
        page.locator(`${EDITOR_SELECTOR} h1`, { hasText: 'Collapsible Heading Clearance' }),
      );
      const headingClearance = await measureCollapseToggleClearance(page, {
        targetSelector: '.milkdown .ProseMirror h1',
        targetText: 'Collapsible Heading Clearance',
        toggleSelector: ':scope > .heading-toggle-btn',
      });
      expect(headingClearance.handleGapX).toBeGreaterThanOrEqual(10);
      const headingSurface = await measureSelectedSurfaceCoverage(page, {
        targetSelector: '.milkdown .ProseMirror h1',
        targetText: 'Collapsible Heading Clearance',
      });
      expect(headingSurface.bleedStart).toBeGreaterThanOrEqual(72);
      expect(headingSurface.visualLeft).toBeLessThanOrEqual(headingSurface.controlsLeft + 1);
      expect(headingSurface.visualRight).toBeGreaterThanOrEqual(headingSurface.controlsRight - 1);

      await page.locator(`${EDITOR_SELECTOR} .editor-collapse-btn[data-has-content="true"]`).first().click();
      await expect(page.locator(`${EDITOR_SELECTOR} .editor-collapse-btn[data-collapsed="true"]`).first()).toBeAttached();

      await selectNoteBlocksByMatchers(page, [{ include: 'Parent collapse row' }]);
      await moveMouseToBlockHandleGutter(
        page,
        page.locator(`${EDITOR_SELECTOR} > ul > li`, { hasText: 'Parent collapse row' }),
      );
      const listClearance = await measureCollapseToggleClearance(page, {
        targetSelector: '.milkdown .ProseMirror > ul > li',
        targetText: 'Parent collapse row',
        toggleSelector: ':scope > .editor-collapse-btn',
      });
      expect(listClearance.handleGapX).toBeGreaterThanOrEqual(10);
      const listSurface = await measureSelectedSurfaceCoverage(page, {
        targetSelector: '.milkdown .ProseMirror > ul > li',
        targetText: 'Parent collapse row',
      });
      expect(listSurface.bleedStart).toBeGreaterThanOrEqual(96);
      expect(listSurface.visualLeft).toBeLessThanOrEqual(listSurface.controlsLeft + 1);
      expect(listSurface.visualRight).toBeGreaterThanOrEqual(listSurface.controlsRight - 1);

      const handleBox = await page.locator('.editor-block-control-handle').boundingBox();
      if (!handleBox) {
        throw new Error('Could not resolve block drag handle geometry');
      }
      const dragStartX = handleBox.x + handleBox.width / 2;
      const dragStartY = handleBox.y + handleBox.height / 2;
      await page.mouse.move(dragStartX, dragStartY);
      await page.mouse.down();
      await page.mouse.move(dragStartX + 20, dragStartY + 16, { steps: 4 });

      const draggingClearance = await measureCollapseToggleClearance(page, {
        targetSelector: '.milkdown .ProseMirror > ul > li',
        targetText: 'Parent collapse row',
        toggleSelector: ':scope > .editor-collapse-btn',
      });
      expect(draggingClearance.handleGapX).toBeGreaterThanOrEqual(10);
      const draggingSurface = await measureSelectedSurfaceCoverage(page, {
        targetSelector: '.milkdown .ProseMirror > ul > li',
        targetText: 'Parent collapse row',
      });
      expect(draggingSurface.bleedStart).toBeGreaterThanOrEqual(96);
      expect(draggingSurface.visualLeft).toBeLessThanOrEqual(draggingSurface.controlsLeft + 1);
      expect(draggingSurface.visualRight).toBeGreaterThanOrEqual(draggingSurface.controlsRight - 1);
      expect(draggingSurface.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(draggingSurface.boxShadow).toBe('none');
      expect(draggingSurface.afterBackgroundColor).toBe(draggingSurface.expectedBackground);
      expect(draggingSurface.afterLeft).not.toBeNull();
      expect(draggingSurface.afterRight).not.toBeNull();
      expect(draggingSurface.afterLeft!).toBeCloseTo(-draggingSurface.bleedStart, 0);
      expect(draggingSurface.afterRight!).toBeCloseTo(-draggingSurface.bleedEnd, 0);

      await page.mouse.up();
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps block drag handles aligned and paints dragged sources for nested selections', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-nested-block-drag-handle');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const { notePath } = await page.evaluate(() =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'nested-block-drag-handle.md',
          content: [
            '# Nested Block Drag',
            '',
            '- Parent item',
            '  - Nested child drag source',
            '',
            'Standalone following paragraph',
            '',
          ].join('\n'),
        })
      );

      await page.evaluate((pathToOpen) => (window as any).__vlainaE2E.openAbsoluteNote(pathToOpen), notePath);
      await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Standalone following paragraph' })).toBeVisible();

      const selectedCount = await page.evaluate(() => {
        const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks();
        const nestedIndex = blocks.findIndex((block: { text: string }) => block.text === 'Nested child drag source');
        const standaloneIndex = blocks.findIndex((block: { text: string }) => block.text === 'Standalone following paragraph');
        if (nestedIndex < 0 || standaloneIndex < 0) return 0;
        return (window as any).__vlainaE2E.selectNoteBlocksByIndexes([nestedIndex, standaloneIndex]);
      });
      expect(selectedCount).toBe(2);

      const standaloneRect = await page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Standalone following paragraph' }).boundingBox();
      if (!standaloneRect) {
        throw new Error('Could not resolve standalone paragraph geometry');
      }

      await page.mouse.move(Math.max(8, standaloneRect.x - 18), standaloneRect.y + standaloneRect.height / 2);
      await expect(page.locator(BLOCK_CONTROLS_SELECTOR)).toBeVisible();

      const alignedGeometry = await page.evaluate(() => {
        const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible');
        const standalone = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror p'))
          .find((element) => element.textContent?.includes('Standalone following paragraph'));
        if (!controls || !standalone) return null;
        const controlsRect = controls.getBoundingClientRect();
        const standaloneRect = standalone.getBoundingClientRect();
        return {
          controlsCenterY: controlsRect.top + controlsRect.height / 2,
          standaloneCenterY: standaloneRect.top + standaloneRect.height / 2,
          handleGapX: standaloneRect.left - controlsRect.left,
        };
      });
      expect(alignedGeometry).not.toBeNull();
      expect(Math.abs(alignedGeometry!.controlsCenterY - alignedGeometry!.standaloneCenterY)).toBeLessThanOrEqual(2);
      expect(alignedGeometry!.handleGapX).toBeGreaterThan(24);
      expect(alignedGeometry!.handleGapX).toBeLessThan(72);

      const handleBox = await page.locator('.editor-block-control-handle').boundingBox();
      if (!handleBox) {
        throw new Error('Could not resolve block drag handle geometry');
      }
      await page.locator('.editor-block-control-handle').hover();

      const handleColor = await page.evaluate(() => {
        const handle = document.querySelector<HTMLElement>('.editor-block-control-handle');
        const path = handle?.querySelector<SVGPathElement>('path');
        if (!handle || !path) return null;
        const probe = document.createElement('span');
        probe.style.color = 'var(--vlaina-color-accent)';
        document.body.appendChild(probe);
        const accentColor = getComputedStyle(probe).color;
        probe.remove();
        return {
          iconFill: getComputedStyle(path).fill,
          accentColor,
          isHovered: handle.matches(':hover'),
        };
      });
      expect(handleColor).not.toBeNull();
      expect(handleColor!.isHovered).toBe(true);
      expect(handleColor!.iconFill).toBe(handleColor!.accentColor);

      const dragStartBox = await page.locator('.editor-block-control-handle').boundingBox();
      if (!dragStartBox) {
        throw new Error('Could not resolve block drag handle geometry after hover');
      }
      const dragStartX = dragStartBox.x + dragStartBox.width / 2;
      const dragStartY = dragStartBox.y + dragStartBox.height / 2;
      await page.mouse.move(dragStartX, dragStartY);
      await page.mouse.down();
      await page.mouse.move(dragStartX + 24, dragStartY + 24, { steps: 4 });

      const dragVisual = await page.evaluate(() => {
        const source = document.querySelector<HTMLElement>(
          '.milkdown .ProseMirror .editor-block-selected, .milkdown .ProseMirror .editor-block-drag-source'
        );
        if (!source) return null;
        const probe = document.createElement('span');
        probe.style.backgroundColor = 'var(--vlaina-block-selection-color-default)';
        document.body.appendChild(probe);
        const expectedBackground = getComputedStyle(probe).backgroundColor;
        probe.remove();
        const style = getComputedStyle(source);
        const afterStyle = getComputedStyle(source, '::after');
        const afterLeft = Number.parseFloat(afterStyle.left);
        const afterRight = Number.parseFloat(afterStyle.right);
        const bleedStart = Number.parseFloat(style.getPropertyValue('--vlaina-block-selection-bleed-x-start'));
        const bleedEnd = Number.parseFloat(style.getPropertyValue('--vlaina-block-selection-bleed-x-end'));
        const previewLayer = document.querySelector<HTMLElement>('.editor-block-drag-preview-layer');
        const previewLayerStyle = previewLayer ? getComputedStyle(previewLayer) : null;
        return {
          dragActive: document.body.classList.contains('editor-block-drag-active'),
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
          sourceOpacity: style.opacity,
          afterBackgroundColor: afterStyle.backgroundColor,
          afterLeft: Number.isFinite(afterLeft) ? afterLeft : null,
          afterRight: Number.isFinite(afterRight) ? afterRight : null,
          bleedStart: Number.isFinite(bleedStart) ? bleedStart : null,
          bleedEnd: Number.isFinite(bleedEnd) ? bleedEnd : null,
          expectedBackground,
          previewLayerBackgroundColor: previewLayerStyle?.backgroundColor ?? null,
          previewLayerOpacity: previewLayerStyle?.opacity ?? null,
          previewLayerBoxShadow: previewLayerStyle?.boxShadow ?? null,
          selectedCount: document.querySelectorAll('.milkdown .ProseMirror .editor-block-selected').length,
          sourceCount: document.querySelectorAll('.milkdown .ProseMirror .editor-block-drag-source').length,
        };
      });
      expect(dragVisual).not.toBeNull();
      expect(dragVisual!.dragActive).toBe(true);
      expect(dragVisual!.selectedCount + dragVisual!.sourceCount).toBeGreaterThan(0);
      expectDragSourceSelectionSurface('nested-selection-source', {
        sourceBackgroundColor: dragVisual!.backgroundColor,
        sourceBoxShadow: dragVisual!.boxShadow,
        sourceAfterBackgroundColor: dragVisual!.afterBackgroundColor,
        sourceAfterLeft: dragVisual!.afterLeft,
        sourceAfterRight: dragVisual!.afterRight,
        sourceBleedStart: dragVisual!.bleedStart,
        sourceBleedEnd: dragVisual!.bleedEnd,
        expectedBackground: dragVisual!.expectedBackground,
      });
      expect(dragVisual!.sourceOpacity).toBe('1');
      expect(dragVisual!.previewLayerBackgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(dragVisual!.previewLayerOpacity).toBe('1');
      expect(dragVisual!.previewLayerBoxShadow).toBe('none');

      await page.mouse.up();
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
