import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

test.describe('notes title keyboard navigation', () => {
  test.setTimeout(90_000);

  test('moves from the first body line end to the note title with ArrowUp without changing markdown', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-title-arrow-up-navigation');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const body = ['First body line arrow up sentinel', 'Second body line arrow up sentinel'].join('\n');
      await openMarkdownFixture(page, {
        filename: 'title-arrow-up-navigation.md',
        content: body,
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('First body line arrow up sentinel');
      const selected = await page.evaluate(
        (targetText) => (window as any).__vlainaE2E.selectEditorTextByText(targetText, targetText),
        'First body line arrow up sentinel',
      );
      expect(selected.selected).toBe(true);

      await page.keyboard.press('ArrowRight');
      await waitForEditorAnimationFrame(page);
      await expect.poll(
        async () => page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary()),
        { timeout: 5_000 },
      ).toMatchObject({
        empty: true,
        from: selected.to,
        to: selected.to,
      });

      await page.keyboard.press('ArrowUp');
      await waitForEditorAnimationFrame(page);

      const state = await page.evaluate(() => {
        const titleInput = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          '[data-note-title-input="true"]',
        );
        const active = document.activeElement;
        return {
          activeIsTitle: active === titleInput,
          hasTitleInput: Boolean(titleInput),
          activeTagName: active?.tagName ?? null,
          activeClassName: active instanceof HTMLElement ? active.className : null,
          activeDataTitleInput: active instanceof HTMLElement ? active.getAttribute('data-note-title-input') : null,
          titleValue: titleInput?.value ?? '',
          selectionStart: titleInput?.selectionStart ?? null,
          selectionEnd: titleInput?.selectionEnd ?? null,
          editorSelection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
          editorText: document.querySelector('.milkdown .ProseMirror')?.textContent ?? '',
          content: String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? ''),
        };
      });

      expect(state.activeIsTitle, JSON.stringify(state, null, 2)).toBe(true);
      expect(state.selectionStart).toBe(state.titleValue.length);
      expect(state.selectionEnd).toBe(state.titleValue.length);
      expect(state.editorText).toContain('First body line arrow up sentinel');
      expect(state.editorText).toContain('Second body line arrow up sentinel');
      expect(state.content).toBe(body);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
