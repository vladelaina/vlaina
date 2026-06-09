import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  createVaultFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  openVaultInNotes,
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
});
