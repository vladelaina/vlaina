import { expect, test } from '@playwright/test';
import {
  BLOCK_CONTROLS_SELECTOR,
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  NOTES_VIEW_SELECTOR,
  NOTE_SOURCE_FALLBACK_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  clearSelectedNoteBlocks,
  collectEditorDomMetrics,
  createVaultFilesFixture,
  getBlankAreaDragTarget,
  getOpenBridgePages,
  launchIsolatedElectron,
  measureRepeatedBlockScan,
  openVaultInNotes,
  selectNoteBlocksByText,
  setAppViewMode,
} from './notesE2E';

function createSidebarMarkdown(label: string): string {
  return [
    `# ${label} Sidebar Note`,
    '',
    `${label} sidebar sentinel paragraph one for opening and rendering.`,
    '',
    `${label} sidebar sentinel paragraph two for block selection.`,
    '',
    '- Sidebar bullet alpha',
    '- Sidebar bullet beta',
    '',
    '> Sidebar quote sentinel',
    '',
    '```ts',
    `const sidebar${label.replace(/[^A-Za-z0-9]/g, '')} = true;`,
    '```',
    '',
    `${label} final sidebar sentinel.`,
    '',
  ].join('\n');
}

test.describe('notes sidebar and block selection interaction', () => {
  test.setTimeout(120_000);

  test('opens notes from the left sidebar and keeps block selection responsive', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-sidebar-selection');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const fixture = await createVaultFilesFixture(page, {
        name: 'sidebar-selection',
        files: [
          { filename: 'alpha-sidebar.md', content: createSidebarMarkdown('Alpha') },
          { filename: 'beta-sidebar.md', content: createSidebarMarkdown('Beta') },
          { filename: 'docs/nested-sidebar.md', content: createSidebarMarkdown('Nested') },
        ],
      });

      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Sidebar Selection Vault',
        minFileCount: 3,
      });

      await expect(page.locator(NOTES_VIEW_SELECTOR)).toBeVisible();
      const betaRow = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'beta-sidebar' }).first();
      await expect(betaRow).toBeVisible();

      const betaClickStartedAt = Date.now();
      await betaRow.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Beta sidebar sentinel paragraph one', {
        timeout: 30_000,
      });
      const betaOpenMs = Date.now() - betaClickStartedAt;

      const betaState = await page.evaluate(() => (window as any).__vlainaE2E.getNotesState());
      expect(betaState.currentNote?.path).toContain('beta-sidebar.md');
      expect(betaState.error).toBeNull();
      await expect(page.locator(NOTE_SOURCE_FALLBACK_SELECTOR)).toHaveCount(0);

      const alphaRow = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'alpha-sidebar' }).first();
      await expect(alphaRow).toBeVisible();
      await alphaRow.hover();
      await page.waitForTimeout(120);

      const alphaClickStartedAt = Date.now();
      await alphaRow.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Alpha sidebar sentinel paragraph one', {
        timeout: 30_000,
      });
      const alphaOpenMs = Date.now() - alphaClickStartedAt;

      const alphaState = await page.evaluate(() => (window as any).__vlainaE2E.getNotesState());
      expect(alphaState.currentNote?.path).toContain('alpha-sidebar.md');
      expect(alphaState.error).toBeNull();

      const metrics = await collectEditorDomMetrics(page);
      const blockScanMetrics = await measureRepeatedBlockScan(page, 12);
      console.info('[notes-sidebar-selection]', {
        betaOpenMs,
        alphaOpenMs,
        renderedBlockCount: metrics.renderedBlockCount,
        selectableBlockCount: metrics.selectableBlockCount,
        blockScanMetrics,
      });

      expect(betaOpenMs).toBeLessThan(5_000);
      expect(alphaOpenMs).toBeLessThan(5_000);
      expect(metrics.countsBySelector.sourceFallback).toBe(0);
      expect(metrics.selectableBlockCount).toBeGreaterThanOrEqual(8);
      expect(blockScanMetrics.p95Ms).toBeLessThan(250);

      const selectedCount = await selectNoteBlocksByText(page, [
        'Alpha sidebar sentinel paragraph one',
        'Sidebar bullet beta',
        'Alpha final sidebar sentinel',
      ]);
      expect(selectedCount).toBe(3);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(3);

      const firstSelectedBox = await page.locator(SELECTED_BLOCK_SELECTOR).first().boundingBox();
      if (!firstSelectedBox) {
        throw new Error('Could not resolve selected block geometry');
      }
      await page.mouse.move(Math.max(8, firstSelectedBox.x - 18), firstSelectedBox.y + firstSelectedBox.height / 2);
      await expect(page.locator(BLOCK_CONTROLS_SELECTOR)).toBeVisible({ timeout: 10_000 });

      const handleGeometry = await page.evaluate(() => {
        const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible');
        const selected = document.querySelector<HTMLElement>('.milkdown .ProseMirror .editor-block-selected');
        if (!controls || !selected) return null;
        const controlsRect = controls.getBoundingClientRect();
        const selectedRect = selected.getBoundingClientRect();
        return {
          centerDeltaY: Math.abs((controlsRect.top + controlsRect.height / 2) - (selectedRect.top + selectedRect.height / 2)),
          controlsLeft: controlsRect.left,
          selectedLeft: selectedRect.left,
        };
      });
      expect(handleGeometry).not.toBeNull();
      expect(handleGeometry!.centerDeltaY).toBeLessThanOrEqual(2);
      expect(handleGeometry!.controlsLeft).toBeLessThan(handleGeometry!.selectedLeft);

      await clearSelectedNoteBlocks(page);
      const dragTarget = await getBlankAreaDragTarget(page, 'Alpha sidebar sentinel paragraph one');
      expect(dragTarget).not.toBeNull();

      const dragStartedAt = Date.now();
      await page.mouse.move(dragTarget!.startX, dragTarget!.startY);
      await page.mouse.down();
      await page.mouse.move(dragTarget!.endX, dragTarget!.endY, { steps: 8 });
      await page.mouse.up();
      const dragMs = Date.now() - dragStartedAt;

      await expect(page.locator(SELECTED_BLOCK_SELECTOR).first()).toBeVisible({ timeout: 10_000 });
      const dragDiagnostics = await page.evaluate(() => ({
        selectedCount: document.querySelectorAll('.milkdown .ProseMirror .editor-block-selected').length,
        dragBoxCount: document.querySelectorAll('[data-editor-drag-box="true"]').length,
      }));
      console.info('[notes-sidebar-selection-drag]', {
        dragMs,
        dragTarget,
        dragDiagnostics,
      });
      expect(dragMs).toBeLessThan(5_000);
      expect(dragDiagnostics.selectedCount).toBeGreaterThan(0);
      expect(dragDiagnostics.dragBoxCount).toBe(0);

      await setAppViewMode(page, 'chat');
      await setAppViewMode(page, 'notes');
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Alpha sidebar sentinel paragraph one');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
