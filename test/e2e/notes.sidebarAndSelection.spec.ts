import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  BLOCK_CONTROLS_SELECTOR,
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  NOTES_SIDEBAR_SCROLL_ROOT_SELECTOR,
  NOTES_VIEW_SELECTOR,
  NOTE_SOURCE_FALLBACK_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  clearSelectedNoteBlocks,
  collectEditorDomMetrics,
  createNotesRootFilesFixture,
  getBlankAreaDragTarget,
  getOpenBridgePages,
  launchIsolatedElectron,
  measureRepeatedBlockScan,
  openNotesRootInNotes,
  selectNoteBlocksByText,
  setAppViewMode,
} from './notesE2E';

const SELECTED_NODE_SELECTOR = `${EDITOR_SELECTOR} .ProseMirror-selectednode`;
const SELECTED_MARKDOWN_BLANK_LINE_SELECTOR = [
  `${EDITOR_SELECTOR} [data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"].editor-block-selected`,
  `${EDITOR_SELECTOR} [data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"].ProseMirror-selectednode`,
  `${EDITOR_SELECTOR} p.editor-editable-markdown-blank-line.editor-block-selected`,
  `${EDITOR_SELECTOR} p.editor-editable-markdown-blank-line.ProseMirror-selectednode`,
].join(', ');
const SIDEBAR_CONTEXT_MENU_LAYER_SELECTOR = [
  '[data-notes-sidebar-context-menu-layer="true"]',
  '[data-sidebar-context-menu-layer="true"]',
].join(', ');
const NOTES_SIDEBAR_BLANK_DRAG_ROOT_SELECTOR = '[data-notes-sidebar-blank-drag-root="true"]';

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

function createTrailingBlankLineMarkdown(label: string): string {
  return [
    `# ${label} trailing blank line note`,
    '',
    `${label} body sentinel before the final markdown blank line.`,
    '',
    '<!--vlaina-markdown-blank-line-->',
  ].join('\n');
}

async function getSidebarRowSurfaceVisual(row: Locator) {
  return row.evaluate((element) => {
    const surface = element.querySelector<HTMLElement>(':scope > div > div');
    if (!surface) {
      throw new Error('Could not resolve sidebar row surface');
    }
    const style = window.getComputedStyle(surface);
    return {
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      color: style.color,
    };
  });
}

async function expectNoEditorBlockOrNodeSelection(page: Page) {
  await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
  await expect(page.locator(SELECTED_NODE_SELECTOR)).toHaveCount(0);
  await expect(page.locator(SELECTED_MARKDOWN_BLANK_LINE_SELECTOR)).toHaveCount(0);
}

test.describe('notes sidebar and block selection interaction', () => {
  test.setTimeout(120_000);

  test('keeps dark sidebar right-click highlighted without selecting the trailing blank line', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-sidebar-dark-right-click-blank-line');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const fixture = await createNotesRootFilesFixture(page, {
        name: 'sidebar-dark-right-click-blank-line',
        files: [
          { filename: 'alpha-trailing-blank.md', content: createTrailingBlankLineMarkdown('Alpha') },
          { filename: 'beta-context-target.md', content: createSidebarMarkdown('Beta') },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Sidebar Dark Right Click NotesRoot',
        minFileCount: 2,
      });

      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      });

      const alphaRow = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'alpha-trailing-blank' }).first();
      await expect(alphaRow).toBeVisible();
      await alphaRow.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Alpha body sentinel before the final markdown blank line', {
        timeout: 30_000,
      });
      await expectNoEditorBlockOrNodeSelection(page);

      const bodyText = page.locator(EDITOR_SELECTOR).getByText('Alpha body sentinel before the final markdown blank line').first();
      await expect(bodyText).toBeVisible();
      await bodyText.click();
      await expect.poll(
        async () => page.evaluate(() => {
          const editor = document.querySelector('.milkdown .ProseMirror');
          return document.activeElement === editor || Boolean(document.activeElement?.closest('.ProseMirror'));
        }),
        { timeout: 5_000 },
      ).toBe(true);

      const trailingBlankPoint = await page.evaluate((editorSelector) => {
        const editor = document.querySelector<HTMLElement>(editorSelector);
        if (!editor) return null;
        const children = Array.from(editor.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
        const lastChild = children.at(-1);
        if (!lastChild) return null;
        lastChild.scrollIntoView({ block: 'center', inline: 'nearest' });
        const editorRect = editor.getBoundingClientRect();
        const lastRect = lastChild.getBoundingClientRect();
        const x = Math.max(editorRect.left + 48, Math.min(lastRect.left + 48, editorRect.right - 24));
        const y = Math.min(lastRect.bottom + 8, editorRect.bottom - 20);
        const hit = document.elementFromPoint(x, y);
        return {
          x,
          y,
          hitInsideEditor: hit instanceof Node && editor.contains(hit),
          hitIsEditor: hit === editor,
          hitTagName: hit instanceof HTMLElement ? hit.tagName : null,
          lastTagName: lastChild.tagName,
          lastClassName: lastChild.className,
        };
      }, EDITOR_SELECTOR);
      expect(trailingBlankPoint).not.toBeNull();
      expect(trailingBlankPoint!.hitInsideEditor).toBe(true);
      await page.mouse.click(trailingBlankPoint!.x, trailingBlankPoint!.y);
      await expectNoEditorBlockOrNodeSelection(page);

      await alphaRow.click({ button: 'right' });
      await expect(page.locator(SIDEBAR_CONTEXT_MENU_LAYER_SELECTOR)).toBeVisible({ timeout: 10_000 });
      await expectNoEditorBlockOrNodeSelection(page);
      await page.keyboard.press('Escape');
      await expect(page.locator(SIDEBAR_CONTEXT_MENU_LAYER_SELECTOR)).toHaveCount(0);

      const betaRow = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'beta-context-target' }).first();
      await expect(betaRow).toBeVisible();
      const idleVisual = await getSidebarRowSurfaceVisual(betaRow);
      await betaRow.hover();
      await page.waitForTimeout(120);
      const hoverVisual = await getSidebarRowSurfaceVisual(betaRow);
      expect(
        hoverVisual.backgroundColor !== idleVisual.backgroundColor ||
        hoverVisual.boxShadow !== idleVisual.boxShadow ||
        hoverVisual.color !== idleVisual.color
      ).toBe(true);

      await betaRow.click({ button: 'right' });
      await expect(page.locator(SIDEBAR_CONTEXT_MENU_LAYER_SELECTOR)).toBeVisible({ timeout: 10_000 });

      const editorBox = await page.locator(EDITOR_SELECTOR).boundingBox();
      expect(editorBox).not.toBeNull();
      await page.mouse.move(editorBox!.x + editorBox!.width / 2, editorBox!.y + 24);
      await page.waitForTimeout(120);

      const rightClickVisual = await getSidebarRowSurfaceVisual(betaRow);
      expect(rightClickVisual.backgroundColor).toBe(hoverVisual.backgroundColor);
      expect(rightClickVisual.boxShadow).toBe(hoverVisual.boxShadow);
      expect(rightClickVisual.color).toBe(hoverVisual.color);
      await expectNoEditorBlockOrNodeSelection(page);

      await page.keyboard.press('Escape');
      await expect(page.locator(SIDEBAR_CONTEXT_MENU_LAYER_SELECTOR)).toHaveCount(0);

      const blankSidebarArea = page.locator(NOTES_SIDEBAR_BLANK_DRAG_ROOT_SELECTOR).first();
      await expect(blankSidebarArea).toBeVisible();
      const blankBox = await blankSidebarArea.boundingBox();
      if (blankBox && blankBox.width > 2 && blankBox.height > 2) {
        await page.mouse.click(blankBox.x + blankBox.width / 2, blankBox.y + blankBox.height / 2);
      } else {
        const scrollBox = await page.locator(NOTES_SIDEBAR_SCROLL_ROOT_SELECTOR).first().boundingBox();
        expect(scrollBox).not.toBeNull();
        await page.mouse.click(scrollBox!.x + scrollBox!.width / 2, scrollBox!.y + scrollBox!.height - 8);
      }
      await expectNoEditorBlockOrNodeSelection(page);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('opens notes from the left sidebar and keeps block selection responsive', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-sidebar-selection');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const fixture = await createNotesRootFilesFixture(page, {
        name: 'sidebar-selection',
        files: [
          { filename: 'alpha-sidebar.md', content: createSidebarMarkdown('Alpha') },
          { filename: 'beta-sidebar.md', content: createSidebarMarkdown('Beta') },
          { filename: 'docs/nested-sidebar.md', content: createSidebarMarkdown('Nested') },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Sidebar Selection NotesRoot',
        minFileCount: 2,
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
      expect(handleGeometry!.centerDeltaY).toBeLessThanOrEqual(4);
      expect(handleGeometry!.controlsLeft).toBeLessThan(handleGeometry!.selectedLeft);

      await clearSelectedNoteBlocks(page);
      const sidebarBlankDragTarget = await page.evaluate(async () => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        const blankArea = document.querySelector<HTMLElement>(
          '[data-notes-sidebar-blank-drag-root="true"][data-file-tree-root-drop-target="true"]'
        );
        if (!editor || !blankArea) return null;

        const block = Array.from(editor.querySelectorAll<HTMLElement>('p,li,blockquote,pre,table,h1,h2,h3,h4,h5,h6'))
          .find((element) => element.textContent?.includes('Alpha sidebar sentinel paragraph one')) ?? null;
        if (!block) return null;

        block.scrollIntoView({ block: 'center', inline: 'nearest' });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        const blankRect = blankArea.getBoundingClientRect();
        const blockRect = block.getBoundingClientRect();
        if (blankRect.width < 8 || blankRect.height < 8 || blockRect.width < 8 || blockRect.height < 8) {
          return null;
        }

        const startX = blankRect.left + blankRect.width / 2;
        const startY = blankRect.top + Math.min(Math.max(12, blankRect.height * 0.35), blankRect.height - 4);
        const endX = blockRect.left + Math.min(Math.max(120, blockRect.width * 0.4), blockRect.width - 24);
        const endY = blockRect.top + blockRect.height / 2;
        const hit = document.elementFromPoint(startX, startY);

        return {
          startX,
          startY,
          endX,
          endY,
          hitInsideEditor: hit instanceof Node && editor.contains(hit),
          hitInsideBlankArea: hit instanceof Node && blankArea.contains(hit),
          hitTagName: hit instanceof HTMLElement ? hit.tagName : null,
        };
      });
      expect(sidebarBlankDragTarget, 'sidebar blank drag target').not.toBeNull();
      expect(sidebarBlankDragTarget!.hitInsideEditor, JSON.stringify(sidebarBlankDragTarget, null, 2)).toBe(false);
      expect(sidebarBlankDragTarget!.hitInsideBlankArea, JSON.stringify(sidebarBlankDragTarget, null, 2)).toBe(true);

      await page.mouse.move(sidebarBlankDragTarget!.startX, sidebarBlankDragTarget!.startY);
      await page.mouse.down();
      await page.mouse.move(sidebarBlankDragTarget!.endX, sidebarBlankDragTarget!.endY, { steps: 10 });
      await page.mouse.up();

      await expect.poll(async () => page.evaluate(() => {
        const selected = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror .editor-block-selected'))
          .map((element) => element.textContent?.trim() ?? '');
        return {
          selectedCount: selected.length,
          hasTarget: selected.some((text) => text.includes('Alpha sidebar sentinel paragraph one')),
        };
      })).toMatchObject({
        selectedCount: expect.any(Number),
        hasTarget: true,
      });

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
