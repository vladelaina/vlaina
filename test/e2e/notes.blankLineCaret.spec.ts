import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  createVaultFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openAbsoluteNote,
  openMarkdownFixture,
  openVaultInNotes,
  selectNoteBlocksByText,
  waitForEditorAnimationFrame,
} from './notesE2E';

const BLANK_LINE_SELECTOR = `${EDITOR_SELECTOR} [data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"], ${EDITOR_SELECTOR} p.editor-editable-markdown-blank-line, ${EDITOR_SELECTOR} p:empty`;
const SELECTED_NODE_SELECTOR = `${EDITOR_SELECTOR} .ProseMirror-selectednode`;
const SELECTED_MARKDOWN_BLANK_LINE_SELECTOR = [
  `${EDITOR_SELECTOR} [data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"].editor-block-selected`,
  `${EDITOR_SELECTOR} [data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"].ProseMirror-selectednode`,
  `${EDITOR_SELECTOR} p.editor-editable-markdown-blank-line.editor-block-selected`,
  `${EDITOR_SELECTOR} p.editor-editable-markdown-blank-line.ProseMirror-selectednode`,
].join(', ');

test.describe('notes blank line caret interaction', () => {
  test.setTimeout(120_000);

  test('places the caret into a blank markdown line when clicked', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-blank-line-caret');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'blank-line-caret-e2e.md',
        content: ['Alpha blank line sentinel', '', 'Beta blank line sentinel'].join('\n'),
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Alpha blank line sentinel');
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Beta blank line sentinel');
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);

      const blankLine = page.locator(BLANK_LINE_SELECTOR).first();
      await expect(blankLine).toBeVisible({ timeout: 30_000 });
      await blankLine.scrollIntoViewIfNeeded();

      const box = await blankLine.boundingBox();
      expect(box).not.toBeNull();
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.keyboard.type('Inserted blank line text');

      const after = await page.locator(EDITOR_SELECTOR).evaluate((editor) => ({
        text: editor.textContent ?? '',
        selectedBlocks: editor.querySelectorAll('.editor-block-selected').length,
        activeElementClass: document.activeElement?.getAttribute('class') ?? '',
        domSelection: window.getSelection()?.toString() ?? '',
        paragraphs: Array.from(editor.querySelectorAll('p')).map((paragraph) => ({
          text: paragraph.textContent ?? '',
          className: paragraph.getAttribute('class') ?? '',
        })),
      }));

      expect(after.selectedBlocks).toBe(0);
      expect(after.domSelection).toBe('');
      expect(after.text).toContain('Alpha blank line sentinel');
      expect(after.text).toContain('Inserted blank line text');
      expect(after.text).toContain('Beta blank line sentinel');
      expect(after.paragraphs.map((paragraph) => paragraph.text)).toEqual([
        'Alpha blank line sentinel',
        'Inserted blank line text',
        'Beta blank line sentinel',
      ]);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('does not block-select markdown blank lines when moving through them with keyboard', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-blank-line-keyboard-navigation');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const betaText = 'Beta keyboard blank line sentinel';
      await openMarkdownFixture(page, {
        filename: 'blank-line-keyboard-navigation-e2e.md',
        content: [
          'Alpha keyboard blank line sentinel',
          '',
          betaText,
          '',
          'Gamma keyboard blank line sentinel',
        ].join('\n'),
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText(betaText);
      await expect(page.locator(BLANK_LINE_SELECTOR)).toHaveCount(2);

      const selectBetaText = async () => {
        const selected = await page.evaluate(
          (targetText) => (window as any).__vlainaE2E.selectEditorTextByText(targetText, targetText),
          betaText,
        );
        expect(selected.selected).toBe(true);
        return selected as { from: number; to: number };
      };

      const assertNoBlankLineSelection = async () => {
        await waitForEditorAnimationFrame(page);
        await waitForEditorAnimationFrame(page);
        await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
        await expect(page.locator(SELECTED_NODE_SELECTOR)).toHaveCount(0);
        await expect(page.locator(SELECTED_MARKDOWN_BLANK_LINE_SELECTOR)).toHaveCount(0);
        await expect.poll(
          async () => page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary()),
          { timeout: 5_000 },
        ).toMatchObject({
          empty: true,
          selectedText: '',
        });
      };

      const selectedForUp = await selectBetaText();
      await page.keyboard.press('ArrowLeft');
      await waitForEditorAnimationFrame(page);
      await expect.poll(
        async () => page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary()),
        { timeout: 5_000 },
      ).toMatchObject({
        empty: true,
        from: selectedForUp.from,
      });
      await page.keyboard.press('ArrowUp');
      await assertNoBlankLineSelection();

      const selectedForDown = await selectBetaText();
      await page.keyboard.press('ArrowRight');
      await waitForEditorAnimationFrame(page);
      await expect.poll(
        async () => page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary()),
        { timeout: 5_000 },
      ).toMatchObject({
        empty: true,
        from: selectedForDown.to,
      });
      await page.keyboard.press('ArrowDown');
      await assertNoBlankLineSelection();
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('does not auto-select markdown blank line blocks when switching notes from the file tree', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-blank-line-file-tree-selection');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const fixture = await createVaultFilesFixture(page, {
        name: 'blank-line-file-tree-selection',
        files: [
          {
            filename: 'alpha-blank-lines.md',
            content: ['Alpha file tree sentinel', '', 'Alpha after blank line'].join('\n'),
          },
          {
            filename: 'beta-blank-lines.md',
            content: ['Beta file tree sentinel', '', 'Beta after blank line'].join('\n'),
          },
        ],
      });
      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Blank Line Selection Vault',
        minFileCount: 2,
      });

      for (const filename of ['alpha-blank-lines', 'beta-blank-lines', 'alpha-blank-lines']) {
        await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: filename }).first().click();
        await expect(page.locator(EDITOR_SELECTOR)).toContainText(
          filename.startsWith('alpha') ? 'Alpha file tree sentinel' : 'Beta file tree sentinel',
          { timeout: 30_000 }
        );
        await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
        await expect(page.locator(SELECTED_NODE_SELECTOR)).toHaveCount(0);
        await expect(page.locator(SELECTED_MARKDOWN_BLANK_LINE_SELECTOR)).toHaveCount(0);
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('does not auto-select leading markdown blank line blocks when opening notes', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-leading-blank-line-selection');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'leading-blank-line-selection-e2e.md',
        content: ['', 'Leading blank line sentinel', '', 'Body after leading blank line'].join('\n'),
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Leading blank line sentinel');
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
      await expect(page.locator(SELECTED_NODE_SELECTOR)).toHaveCount(0);
      await expect(page.locator(SELECTED_MARKDOWN_BLANK_LINE_SELECTOR)).toHaveCount(0);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('clears stale block selection when opening a note that starts with a blank line', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-leading-blank-line-stale-selection');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const fixture = await createVaultFilesFixture(page, {
        name: 'leading-blank-line-stale-selection',
        files: [
          {
            filename: 'alpha-selected-source.md',
            content: ['Alpha stale block selection source', '', 'Alpha after blank line'].join('\n'),
          },
          {
            filename: 'beta-leading-blank-line.md',
            content: ['', 'Beta leading blank line sentinel', '', 'Beta body after blank line'].join('\n'),
          },
        ],
      });
      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Leading Blank Line Stale Selection Vault',
        minFileCount: 2,
      });

      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'alpha-selected-source' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Alpha stale block selection source', {
        timeout: 30_000,
      });
      expect(await selectNoteBlocksByText(page, ['Alpha stale block selection source'])).toBe(1);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(1);

      await openAbsoluteNote(page, fixture.notePaths[1]);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Beta leading blank line sentinel', {
        timeout: 30_000,
      });
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
      await expect(page.locator(SELECTED_NODE_SELECTOR)).toHaveCount(0);
      await expect(page.locator(SELECTED_MARKDOWN_BLANK_LINE_SELECTOR)).toHaveCount(0);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('does not turn a focused cursor into a selected leading blank line when opening notes', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-focused-leading-blank-line-selection');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const fixture = await createVaultFilesFixture(page, {
        name: 'focused-leading-blank-line-selection',
        files: [
          {
            filename: 'alpha-focused-source.md',
            content: ['Alpha focused cursor source', '', 'Alpha after blank line'].join('\n'),
          },
          {
            filename: 'beta-focused-leading-blank-line.md',
            content: ['', 'Beta focused leading blank line sentinel', '', 'Beta body after blank line'].join('\n'),
          },
        ],
      });
      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Focused Leading Blank Line Vault',
        minFileCount: 2,
      });

      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'alpha-focused-source' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Alpha focused cursor source', {
        timeout: 30_000,
      });
      await expect(
        page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditor())
      ).resolves.toBe(true);

      await openAbsoluteNote(page, fixture.notePaths[1]);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Beta focused leading blank line sentinel', {
        timeout: 30_000,
      });

      await expect.poll(
        async () => page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary()),
        { timeout: 10_000 }
      ).toMatchObject({
        empty: true,
      });
      const selection = await page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary());
      expect(selection?.from).toBeGreaterThan(1);
      await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
      await expect(page.locator(SELECTED_NODE_SELECTOR)).toHaveCount(0);
      await expect(page.locator(SELECTED_MARKDOWN_BLANK_LINE_SELECTOR)).toHaveCount(0);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
