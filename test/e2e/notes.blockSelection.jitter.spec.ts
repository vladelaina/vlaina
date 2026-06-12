import { expect, test } from "@playwright/test";
import {
  EDITOR_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  getBlankAreaDragTarget,
  getOpenBridgePages,
  launchIsolatedElectron,
} from "./notesE2E";
import { openBlockSelectionFixture, expectSelectedParagraphs } from "./notesBlockSelectionShared";

test.describe("notes block selection blank-space jitter", () => {
  test.setTimeout(90_000);

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

      const target = await getBlankAreaDragTarget(page, 'Final paragraph');
      expect(target).not.toBeNull();
      expect(target!.hitInsideEditor).toBe(false);

      await page.mouse.move(target!.startX, target!.startY);
      await page.mouse.down();
      await page.mouse.move(target!.endX, target!.endY, { steps: 16 });
      await page.mouse.up();

      await expectSelectedParagraphs(page, ['Final paragraph']);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
