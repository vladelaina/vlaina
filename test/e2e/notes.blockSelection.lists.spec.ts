import { expect, test } from "@playwright/test";
import {
  BLOCK_CONTROLS_SELECTOR,
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from "./notesE2E";
import {
  selectNoteBlocksByMatchers,
  moveMouseToBlockHandleGutter,
  measureVisibleHandleGeometry,
  expectHandleCenteredOnTarget,
  expectHandleAnchoredToListRow,
  expectHandleAnchoredToOuterListRow,
} from "./notesBlockSelectionShared";

test.describe("notes block selection list handles", () => {
  test.setTimeout(90_000);

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
});
