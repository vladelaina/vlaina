import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  BLOCK_CONTROLS_SELECTOR,
  EDITOR_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';
import {
  MARKDOWN_DRAG_SYNTAX_CASES,
  dragVisibleHandleAndMeasure,
  expectDragSourceSelectionSurface,
  expectSyntaxHandleGeometry,
  expectTransparentDragVisual,
  locateSyntaxTarget,
  measureSelectedSurfaceCoverage,
  measureSyntaxHandleGeometry,
  moveMouseToSyntaxHandleGutter,
  selectSyntaxDragCase,
  type BlockTextMatcher,
  type MarkdownDragSyntaxCase,
  type SyntaxHandleGeometry,
} from './notesBlockSelectionDragHelpers';
import { createMarkdownSyntaxFixture } from './notesMarkdownSyntaxFixture';

async function openBlockSelectionFixture(page: Page): Promise<void> {
  const { notePath } = await page.evaluate(() =>
    (window as any).__vlainaE2E.createNotesFixture({
      filename: 'block-selection.md',
      content: [
        '# Block Selection',
        '',
        'First selectable paragraph',
        '',
        'Second selectable paragraph',
        '',
        '- Parent item',
        '  ```js',
        '  const value = 1',
        '  ```',
        '',
        'Final paragraph',
        '',
      ].join('\n'),
    })
  );

  await page.evaluate((pathToOpen) => (window as any).__vlainaE2E.openAbsoluteNote(pathToOpen), notePath);
  await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();
  await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'First selectable paragraph' })).toBeVisible();
  await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Second selectable paragraph' })).toBeVisible();
}

async function expectSelectedParagraphs(page: Page, texts: string[]): Promise<void> {
  await expect.poll(async () => page.evaluate((expectedTexts) => {
    const selected = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror .editor-block-selected'));
    return expectedTexts.map((text) => selected.some((element) => element.textContent?.includes(text)));
  }, texts)).toEqual(texts.map(() => true));
}

async function selectNoteBlocksByMatchers(page: Page, matchers: BlockTextMatcher[]): Promise<void> {
  const result = await page.evaluate(async (targetMatchers) => {
    const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks() as Array<{
      text: string;
      tagName: string;
      from: number;
      to: number;
    }>;
    const usedIndexes = new Set<number>();
    const indexes: number[] = [];
    const missing: BlockTextMatcher[] = [];

    for (const matcher of targetMatchers) {
      const index = blocks.findIndex((block, blockIndex) => {
        if (usedIndexes.has(blockIndex)) return false;
        if (matcher.exact !== undefined && block.text !== matcher.exact) return false;
        if (matcher.include !== undefined && !block.text.includes(matcher.include)) return false;
        if (matcher.exclude?.some((text) => block.text.includes(text))) return false;
        return true;
      });
      if (index < 0) {
        missing.push(matcher);
        continue;
      }
      usedIndexes.add(index);
      indexes.push(index);
    }

    const count = missing.length === 0
      ? await (window as any).__vlainaE2E.selectNoteBlocksByIndexes(indexes)
      : 0;
    return {
      count,
      indexes,
      missing,
      blockTexts: blocks.map((block) => block.text),
    };
  }, matchers);

  expect(result.missing, `Missing selectable blocks from: ${JSON.stringify(result.blockTexts)}`).toEqual([]);
  expect(result.count).toBe(matchers.length);
}

async function moveMouseToBlockHandleGutter(page: Page, locator: Locator): Promise<void> {
  const rect = await locator.boundingBox();
  if (!rect) {
    throw new Error('Could not resolve block geometry');
  }
  await page.mouse.move(Math.max(8, rect.x - 18), rect.y + rect.height / 2);
  await expect(page.locator(BLOCK_CONTROLS_SELECTOR)).toBeVisible();
}

async function measureVisibleHandleGeometry(
  page: Page,
  input: {
    targetSelector: string;
    targetText: string;
    anchorSelector?: string;
    anchorText?: string;
  },
): Promise<{
  controlsCenterY: number;
  targetCenterY: number;
  targetGapX: number;
  anchorGapX: number;
  targetIndentFromAnchorX: number;
}> {
  const geometry = await page.evaluate(({ targetSelector, targetText, anchorSelector, anchorText }) => {
    const findElement = (selector: string, text: string) => (
      Array.from(document.querySelectorAll<HTMLElement>(selector))
        .find((element) => element.textContent?.includes(text)) ?? null
    );
    const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible');
    const target = findElement(targetSelector, targetText);
    const anchor = anchorSelector && anchorText
      ? findElement(anchorSelector, anchorText)
      : target;
    if (!controls || !target || !anchor) return null;

    const controlsRect = controls.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    return {
      controlsCenterY: controlsRect.top + controlsRect.height / 2,
      targetCenterY: targetRect.top + targetRect.height / 2,
      targetGapX: targetRect.left - controlsRect.left,
      anchorGapX: anchorRect.left - controlsRect.left,
      targetIndentFromAnchorX: targetRect.left - anchorRect.left,
    };
  }, input);

  expect(geometry).not.toBeNull();
  return geometry!;
}

function expectHandleCenteredOnTarget(geometry: { controlsCenterY: number; targetCenterY: number }): void {
  expect(Math.abs(geometry.controlsCenterY - geometry.targetCenterY)).toBeLessThanOrEqual(2);
}

function expectHandleAnchoredToListRow(geometry: {
  controlsCenterY: number;
  targetCenterY: number;
  targetGapX: number;
}): void {
  expectHandleCenteredOnTarget(geometry);
  expect(geometry.targetGapX).toBeGreaterThan(48);
  expect(geometry.targetGapX).toBeLessThan(88);
}

function expectHandleAnchoredToOuterListRow(geometry: {
  controlsCenterY: number;
  targetCenterY: number;
  targetGapX: number;
  anchorGapX: number;
  targetIndentFromAnchorX: number;
}): void {
  expectHandleCenteredOnTarget(geometry);
  expect(geometry.anchorGapX).toBeGreaterThan(48);
  expect(geometry.anchorGapX).toBeLessThan(88);
  expect(geometry.targetIndentFromAnchorX).toBeGreaterThan(16);
  expect(geometry.targetGapX).toBeGreaterThan(geometry.anchorGapX + 16);
}

async function measureCollapseToggleClearance(
  page: Page,
  input: {
    targetSelector: string;
    targetText: string;
    toggleSelector: string;
  },
): Promise<{
  handleGapX: number;
}> {
  const geometry = await page.evaluate(({ targetSelector, targetText, toggleSelector }) => {
    const target = Array.from(document.querySelectorAll<HTMLElement>(targetSelector))
      .find((element) => element.textContent?.includes(targetText)) ?? null;
    const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible, .editor-block-controls.dragging');
    const toggle = target?.querySelector<HTMLElement>(toggleSelector) ?? null;
    if (!target || !controls || !toggle) return null;

    const controlsRect = controls.getBoundingClientRect();
    const toggleRect = toggle.getBoundingClientRect();

    return {
      handleGapX: toggleRect.left - controlsRect.right,
    };
  }, input);

  expect(geometry).not.toBeNull();
  return geometry!;
}

test.describe('notes block selection', () => {
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

  test('keeps drag handles and transparent previews stable across markdown syntax blocks', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-drag-syntax-matrix');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'markdown-drag-syntax-matrix.md',
        content: createMarkdownSyntaxFixture(),
      });

      await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Inline marks paragraph' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .code-block-container`, { hasText: 'syntaxSentinel' })).toBeVisible();
      await expect.poll(async () => page.locator(`${EDITOR_SELECTOR} .milkdown-table-block`).count())
        .toBeGreaterThan(0);
      await expect.poll(async () => page.locator(`${EDITOR_SELECTOR} div[data-type="math-block"]`).count())
        .toBeGreaterThan(0);
      await expect.poll(async () => page.locator(`${EDITOR_SELECTOR} div[data-type="mermaid"]`).count())
        .toBeGreaterThan(0);

      const geometrySamples: SyntaxHandleGeometry[] = [];
      for (const syntaxCase of MARKDOWN_DRAG_SYNTAX_CASES) {
        await selectSyntaxDragCase(page, syntaxCase);
        const target = locateSyntaxTarget(page, syntaxCase);
        await expect(target, `${syntaxCase.label}: target should be visible`).toBeVisible();
        await moveMouseToSyntaxHandleGutter(page, syntaxCase);

        const geometry = await measureSyntaxHandleGeometry(page, syntaxCase);
        expectSyntaxHandleGeometry(syntaxCase, geometry);
        geometrySamples.push(geometry);

        const visual = await dragVisibleHandleAndMeasure(page, syntaxCase.label);
        expectTransparentDragVisual(syntaxCase.label, visual);
      }

      const mixedTarget = MARKDOWN_DRAG_SYNTAX_CASES.find((syntaxCase) => syntaxCase.label === 'markdown-table');
      if (!mixedTarget) {
        throw new Error('Missing markdown-table drag syntax case');
      }

      await selectNoteBlocksByMatchers(page, [
        { include: 'Inline marks paragraph' },
        { include: 'Task item unchecked sentinel' },
        { include: 'Table alpha' },
        { include: 'syntaxSentinel' },
      ]);
      await moveMouseToSyntaxHandleGutter(page, mixedTarget);
      const mixedGeometry = await measureSyntaxHandleGeometry(page, mixedTarget);
      expectSyntaxHandleGeometry(mixedTarget, mixedGeometry, { expectedSelectedCount: 4 });

      const mixedVisual = await dragVisibleHandleAndMeasure(page, 'mixed-rich-syntax-selection');
      expectTransparentDragVisual('mixed-rich-syntax-selection', mixedVisual);
      expect(mixedVisual.sourceCount, 'mixed-rich-syntax-selection: source blocks').toBeGreaterThanOrEqual(2);

      console.info('[notes-block-drag-syntax-matrix]', {
        sampledCount: geometrySamples.length,
        samples: geometrySamples.map((sample) => ({
          label: sample.label,
          tagName: sample.targetTagName,
          className: sample.targetClassName,
          targetGapX: Math.round(sample.targetGapX * 10) / 10,
          handleRightGapX: Math.round(sample.handleRightGapX * 10) / 10,
          targetText: sample.targetText,
        })),
        mixed: {
          selectedCount: mixedGeometry.selectedCount,
          sourceCount: mixedVisual.sourceCount,
          targetGapX: Math.round(mixedGeometry.targetGapX * 10) / 10,
        },
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps footnote reference paragraphs draggable with the standard block handle', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-footnote-reference-block-drag');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'footnote-reference-block-drag.md',
        content: [
          '# Footnote Reference Drag',
          '',
          'Footnote reference paragraph alpha[^alpha].',
          '',
          '[^alpha]: Footnote definition body alpha.',
          '',
        ].join('\n'),
      });

      const footnoteCase: MarkdownDragSyntaxCase = {
        label: 'footnote-reference-paragraph',
        targetSelector: 'p',
        targetText: 'Footnote reference paragraph alpha',
        gap: 'standard',
      };

      await expect(
        page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Footnote reference paragraph alpha' }),
      ).toBeVisible();
      await selectSyntaxDragCase(page, footnoteCase);
      await moveMouseToSyntaxHandleGutter(page, footnoteCase);

      const geometry = await measureSyntaxHandleGeometry(page, footnoteCase);
      expectSyntaxHandleGeometry(footnoteCase, geometry);

      const visual = await dragVisibleHandleAndMeasure(page, footnoteCase.label);
      expectTransparentDragVisual(footnoteCase.label, visual);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps child-row handles on the outer edge when a parent list group is selected', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-parent-list-group-drag-handle');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const { notePath } = await page.evaluate(() =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'parent-list-group-drag-handle.md',
          content: [
            '# Parent List Group Drag',
            '',
            '- Parent drag group',
            '  - Nested child stays visually grouped',
            '',
            'Standalone paragraph after group',
            '',
          ].join('\n'),
        })
      );

      await page.evaluate((pathToOpen) => (window as any).__vlainaE2E.openAbsoluteNote(pathToOpen), notePath);
      await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} li li`, { hasText: 'Nested child stays visually grouped' })).toBeVisible();

      const selectedCount = await page.evaluate(() => {
        const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks();
        const parentIndex = blocks.findIndex((block: { text: string }) => block.text.includes('Parent drag group'));
        const childIndex = blocks.findIndex((block: { text: string }) => block.text === 'Nested child stays visually grouped');
        if (parentIndex < 0 || childIndex < 0) return 0;
        return (window as any).__vlainaE2E.selectNoteBlocksByIndexes([parentIndex, childIndex]);
      });
      expect(selectedCount).toBe(2);

      const nestedRect = await page.locator(`${EDITOR_SELECTOR} li li`, { hasText: 'Nested child stays visually grouped' }).boundingBox();
      if (!nestedRect) {
        throw new Error('Could not resolve nested child geometry');
      }

      await page.mouse.move(Math.max(8, nestedRect.x - 18), nestedRect.y + nestedRect.height / 2);
      await expect(page.locator(BLOCK_CONTROLS_SELECTOR)).toBeVisible();

      const geometry = await page.evaluate(() => {
        const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible');
        const parentItem = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror > ul > li'))
          .find((element) => element.textContent?.includes('Parent drag group'));
        const childItem = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror li li'))
          .find((element) => element.textContent?.includes('Nested child stays visually grouped'));
        if (!controls || !parentItem || !childItem) return null;
        const controlsRect = controls.getBoundingClientRect();
        const parentRect = parentItem.getBoundingClientRect();
        const childRect = childItem.getBoundingClientRect();
        return {
          controlsCenterY: controlsRect.top + controlsRect.height / 2,
          childCenterY: childRect.top + childRect.height / 2,
          parentGapX: parentRect.left - controlsRect.left,
          childGapX: childRect.left - controlsRect.left,
          childIndentX: childRect.left - parentRect.left,
        };
      });

      expect(geometry).not.toBeNull();
      expect(Math.abs(geometry!.controlsCenterY - geometry!.childCenterY)).toBeLessThanOrEqual(2);
      expect(geometry!.parentGapX).toBeGreaterThan(48);
      expect(geometry!.parentGapX).toBeLessThan(88);
      expect(geometry!.childIndentX).toBeGreaterThan(16);
      expect(geometry!.childGapX).toBeGreaterThan(geometry!.parentGapX + 16);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps drag handle anchors correct across nested list selection modes', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-nested-handle-anchor-matrix');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const { notePath } = await page.evaluate(() =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'nested-handle-anchor-matrix.md',
          content: [
            '# Nested Handle Anchor Matrix',
            '',
            '- ParentOwnAlpha',
            '  - ChildOnlyBeta',
            '',
            '- ParentWholeAlpha',
            '  - ChildWholeBeta',
            '    - GrandchildWholeGamma',
            '',
            '- ParentMixedAlpha',
            '  - ChildMixedBeta',
            '',
            'StandaloneMixedDelta',
            '',
            '- CodeGroupAlpha',
            '  ```ts',
            '  const codeGroupSentinel = true;',
            '  ```',
            '',
          ].join('\n'),
        })
      );

      await page.evaluate((pathToOpen) => (window as any).__vlainaE2E.openAbsoluteNote(pathToOpen), notePath);
      await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} li li`, { hasText: 'ChildOnlyBeta' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} li li li`, { hasText: 'GrandchildWholeGamma' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .code-block-container`, { hasText: 'codeGroupSentinel' })).toBeVisible();

      await selectNoteBlocksByMatchers(page, [{ exact: 'ChildOnlyBeta' }]);
      await moveMouseToBlockHandleGutter(
        page,
        page.locator(`${EDITOR_SELECTOR} li li`, { hasText: 'ChildOnlyBeta' }),
      );
      const childOnlyGeometry = await measureVisibleHandleGeometry(page, {
        targetSelector: '.milkdown .ProseMirror li li',
        targetText: 'ChildOnlyBeta',
        anchorSelector: '.milkdown .ProseMirror > ul > li',
        anchorText: 'ParentOwnAlpha',
      });
      expectHandleAnchoredToListRow(childOnlyGeometry);
      expect(childOnlyGeometry.targetGapX).toBeGreaterThan(childOnlyGeometry.anchorGapX + 16);

      await selectNoteBlocksByMatchers(page, [
        { include: 'ParentWholeAlpha' },
        { include: 'ChildWholeBeta', exclude: ['ParentWholeAlpha'] },
        { exact: 'GrandchildWholeGamma' },
      ]);
      await moveMouseToBlockHandleGutter(
        page,
        page.locator(`${EDITOR_SELECTOR} li li li`, { hasText: 'GrandchildWholeGamma' }),
      );
      const deepGroupGeometry = await measureVisibleHandleGeometry(page, {
        targetSelector: '.milkdown .ProseMirror li li li',
        targetText: 'GrandchildWholeGamma',
        anchorSelector: '.milkdown .ProseMirror > ul > li',
        anchorText: 'ParentWholeAlpha',
      });
      expectHandleAnchoredToOuterListRow(deepGroupGeometry);

      await selectNoteBlocksByMatchers(page, [
        { include: 'ParentMixedAlpha' },
        { exact: 'ChildMixedBeta' },
        { exact: 'StandaloneMixedDelta' },
      ]);
      await moveMouseToBlockHandleGutter(
        page,
        page.locator(`${EDITOR_SELECTOR} li li`, { hasText: 'ChildMixedBeta' }),
      );
      const mixedChildGeometry = await measureVisibleHandleGeometry(page, {
        targetSelector: '.milkdown .ProseMirror li li',
        targetText: 'ChildMixedBeta',
        anchorSelector: '.milkdown .ProseMirror > ul > li',
        anchorText: 'ParentMixedAlpha',
      });
      expectHandleAnchoredToOuterListRow(mixedChildGeometry);

      await moveMouseToBlockHandleGutter(
        page,
        page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'StandaloneMixedDelta' }),
      );
      const mixedStandaloneGeometry = await measureVisibleHandleGeometry(page, {
        targetSelector: '.milkdown .ProseMirror p',
        targetText: 'StandaloneMixedDelta',
        anchorSelector: '.milkdown .ProseMirror > ul > li',
        anchorText: 'ParentMixedAlpha',
      });
      expectHandleCenteredOnTarget(mixedStandaloneGeometry);
      expect(mixedStandaloneGeometry.targetGapX).toBeGreaterThan(24);
      expect(mixedStandaloneGeometry.targetGapX).toBeLessThan(72);
      expect(mixedStandaloneGeometry.targetGapX).toBeLessThan(mixedStandaloneGeometry.anchorGapX);

      await selectNoteBlocksByMatchers(page, [
        { include: 'CodeGroupAlpha' },
        { include: 'codeGroupSentinel', exclude: ['CodeGroupAlpha'] },
      ]);
      await moveMouseToBlockHandleGutter(
        page,
        page.locator(`${EDITOR_SELECTOR} .code-block-container`, { hasText: 'codeGroupSentinel' }),
      );
      const codeGroupGeometry = await measureVisibleHandleGeometry(page, {
        targetSelector: '.milkdown .ProseMirror .code-block-container',
        targetText: 'codeGroupSentinel',
        anchorSelector: '.milkdown .ProseMirror > ul > li',
        anchorText: 'CodeGroupAlpha',
      });
      expectHandleCenteredOnTarget(codeGroupGeometry);
      expect(codeGroupGeometry.targetGapX).toBeGreaterThan(24);
      expect(codeGroupGeometry.targetGapX).toBeLessThan(72);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('does not select the final block from a small jitter click in trailing blank space', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-final-block-jitter-click');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openBlockSelectionFixture(page);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);

      const point = await page.evaluate((editorSelector) => {
        const editor = document.querySelector<HTMLElement>(editorSelector);
        const finalBlock = Array.from(document.querySelectorAll<HTMLElement>(`${editorSelector} p`))
          .find((element) => element.textContent?.includes('Final paragraph'));
        if (!editor || !finalBlock) return null;

        finalBlock.scrollIntoView({ block: 'center', inline: 'nearest' });
        const editorRect = editor.getBoundingClientRect();
        const blockRect = finalBlock.getBoundingClientRect();
        const x = Math.min(blockRect.right - 10, editorRect.right - 24);
        const y = blockRect.top + blockRect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
          x,
          y,
          hitInsideFinalBlock: hit instanceof Node && finalBlock.contains(hit),
          hitTagName: hit instanceof HTMLElement ? hit.tagName : null,
        };
      }, EDITOR_SELECTOR);
      expect(point).not.toBeNull();

      await page.mouse.move(point!.x, point!.y);
      await page.mouse.down();
      await page.mouse.move(point!.x + 2, point!.y + 5, { steps: 2 });
      await page.mouse.up();

      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
      const finalState = await page.locator(EDITOR_SELECTOR).evaluate((editor) => ({
        selectedText: Array.from(editor.querySelectorAll<HTMLElement>('.editor-block-selected'))
          .map((element) => element.textContent?.trim() ?? ''),
      }));
      expect(finalState.selectedText).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('does not select the final block from a small jitter click below the last block', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-final-block-below-jitter-click');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openBlockSelectionFixture(page);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);

      const point = await page.evaluate((editorSelector) => {
        const editor = document.querySelector<HTMLElement>(editorSelector);
        const finalBlock = Array.from(document.querySelectorAll<HTMLElement>(`${editorSelector} p`))
          .find((element) => element.textContent?.includes('Final paragraph'));
        if (!editor || !finalBlock) return null;

        finalBlock.scrollIntoView({ block: 'center', inline: 'nearest' });
        const editorRect = editor.getBoundingClientRect();
        const blockRect = finalBlock.getBoundingClientRect();
        const x = Math.max(editorRect.left + 48, blockRect.left + 48);
        const y = blockRect.bottom + 6;
        const hit = document.elementFromPoint(x, y);
        return {
          x,
          y,
          finalBlockBottom: blockRect.bottom,
          hitIsEditor: hit === editor,
          hitInsideEditor: hit instanceof Node && editor.contains(hit),
          hitTagName: hit instanceof HTMLElement ? hit.tagName : null,
        };
      }, EDITOR_SELECTOR);
      expect(point).not.toBeNull();
      expect(point!.hitInsideEditor).toBe(true);

      await page.mouse.move(point!.x, point!.y);
      await page.mouse.down();
      await page.mouse.move(point!.x + 2, point!.finalBlockBottom - 2, { steps: 2 });
      await page.mouse.up();

      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
      const finalState = await page.locator(EDITOR_SELECTOR).evaluate((editor) => ({
        selectedText: Array.from(editor.querySelectorAll<HTMLElement>('.editor-block-selected'))
          .map((element) => element.textContent?.trim() ?? ''),
        domSelection: window.getSelection()?.toString() ?? '',
      }));
      expect(finalState.selectedText).toEqual([]);
      expect(finalState.domSelection).toBe('');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('does not select the final block from a small jitter click beside the editor', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-final-block-beside-jitter-click');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openBlockSelectionFixture(page);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);

      const point = await page.evaluate((editorSelector) => {
        const editor = document.querySelector<HTMLElement>(editorSelector);
        const scrollRoot = editor?.closest<HTMLElement>('[data-note-scroll-root="true"]');
        const finalBlock = Array.from(document.querySelectorAll<HTMLElement>(`${editorSelector} p`))
          .find((element) => element.textContent?.includes('Final paragraph'));
        if (!editor || !scrollRoot || !finalBlock) return null;

        finalBlock.scrollIntoView({ block: 'center', inline: 'nearest' });
        const editorRect = editor.getBoundingClientRect();
        const blockRect = finalBlock.getBoundingClientRect();
        const scrollRootRect = scrollRoot.getBoundingClientRect();
        const x = Math.min(scrollRootRect.right - 12, editorRect.right + 8);
        const y = blockRect.top + blockRect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
          x,
          y,
          moveX: editorRect.right - 3,
          hitInsideEditor: hit instanceof Node && editor.contains(hit),
          hitInsideScrollRoot: hit instanceof Node && scrollRoot.contains(hit),
          hitTagName: hit instanceof HTMLElement ? hit.tagName : null,
        };
      }, EDITOR_SELECTOR);
      expect(point).not.toBeNull();
      expect(point!.hitInsideEditor).toBe(false);
      expect(point!.hitInsideScrollRoot).toBe(true);

      await page.mouse.move(point!.x, point!.y);
      await page.mouse.down();
      await page.mouse.move(point!.moveX, point!.y + 2, { steps: 2 });
      await page.mouse.up();

      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
      const finalState = await page.locator(EDITOR_SELECTOR).evaluate((editor) => ({
        selectedText: Array.from(editor.querySelectorAll<HTMLElement>('.editor-block-selected'))
          .map((element) => element.textContent?.trim() ?? ''),
        domSelection: window.getSelection()?.toString() ?? '',
      }));
      expect(finalState.selectedText).toEqual([]);
      expect(finalState.domSelection).toBe('');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('does not select the final block from a small leading-side jitter click beside the editor', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-final-block-leading-beside-jitter-click');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openBlockSelectionFixture(page);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);

      const point = await page.evaluate((editorSelector) => {
        const editor = document.querySelector<HTMLElement>(editorSelector);
        const scrollRoot = editor?.closest<HTMLElement>('[data-note-scroll-root="true"]');
        const finalBlock = Array.from(document.querySelectorAll<HTMLElement>(`${editorSelector} p`))
          .find((element) => element.textContent?.includes('Final paragraph'));
        if (!editor || !scrollRoot || !finalBlock) return null;

        finalBlock.scrollIntoView({ block: 'center', inline: 'nearest' });
        const editorRect = editor.getBoundingClientRect();
        const blockRect = finalBlock.getBoundingClientRect();
        const scrollRootRect = scrollRoot.getBoundingClientRect();
        const x = Math.max(scrollRootRect.left + 12, editorRect.left - 8);
        const y = blockRect.top + blockRect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
          x,
          y,
          moveX: editorRect.left + 3,
          hitInsideEditor: hit instanceof Node && editor.contains(hit),
          hitInsideScrollRoot: hit instanceof Node && scrollRoot.contains(hit),
          hitTagName: hit instanceof HTMLElement ? hit.tagName : null,
        };
      }, EDITOR_SELECTOR);
      expect(point).not.toBeNull();
      expect(point!.hitInsideEditor).toBe(false);
      expect(point!.hitInsideScrollRoot).toBe(true);

      await page.mouse.move(point!.x, point!.y);
      await page.mouse.down();
      await page.mouse.move(point!.moveX, point!.y + 2, { steps: 2 });
      await page.mouse.up();

      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
      const finalState = await page.locator(EDITOR_SELECTOR).evaluate((editor) => ({
        selectedText: Array.from(editor.querySelectorAll<HTMLElement>('.editor-block-selected'))
          .map((element) => element.textContent?.trim() ?? ''),
        domSelection: window.getSelection()?.toString() ?? '',
      }));
      expect(finalState.selectedText).toEqual([]);
      expect(finalState.domSelection).toBe('');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps intentional block selection from beside the editor working', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection-beside-editor');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openBlockSelectionFixture(page);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);

      const point = await page.evaluate((editorSelector) => {
        const editor = document.querySelector<HTMLElement>(editorSelector);
        const scrollRoot = editor?.closest<HTMLElement>('[data-note-scroll-root="true"]');
        const finalBlock = Array.from(document.querySelectorAll<HTMLElement>(`${editorSelector} p`))
          .find((element) => element.textContent?.includes('Final paragraph'));
        if (!editor || !scrollRoot || !finalBlock) return null;

        finalBlock.scrollIntoView({ block: 'center', inline: 'nearest' });
        const editorRect = editor.getBoundingClientRect();
        const blockRect = finalBlock.getBoundingClientRect();
        const scrollRootRect = scrollRoot.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(finalBlock);
        const textRight = Array.from(range.getClientRects())
          .reduce((right, rect) => Math.max(right, rect.right), blockRect.left);
        range.detach();

        const preferredX = Math.max(editorRect.right + 56, textRight + 64);
        const x = preferredX <= scrollRootRect.right - 36
          ? preferredX
          : scrollRootRect.right - 36;
        const y = blockRect.top + blockRect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
          x,
          y,
          outsideTextGutter: x > textRight + 48,
          hitInsideEditor: hit instanceof Node && editor.contains(hit),
          hitInsideScrollRoot: hit instanceof Node && scrollRoot.contains(hit),
          moveX: Math.max(blockRect.left + 48, editorRect.right - 120),
          moveY: y + 4,
        };
      }, EDITOR_SELECTOR);
      expect(point).not.toBeNull();
      expect(point!.outsideTextGutter).toBe(true);
      expect(point!.hitInsideEditor).toBe(false);
      expect(point!.hitInsideScrollRoot).toBe(true);

      await page.mouse.move(point!.x, point!.y);
      await page.mouse.down();
      await page.mouse.move(point!.moveX, point!.moveY, { steps: 10 });
      await page.mouse.up();

      await expectSelectedParagraphs(page, ['Final paragraph']);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
