import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';
import { TINY_PNG_DATA_URL } from './notesMarkdownSyntaxFixture';

const SELECTED_NODE_SELECTOR = `${EDITOR_SELECTOR} .ProseMirror-selectednode`;

test.describe('notes atomic block caret navigation', () => {
  test.setTimeout(120_000);

  test('does not node-select rich blocks when moving through them with keyboard', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-atomic-block-caret-navigation');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'atomic-block-caret-navigation-e2e.md',
        content: [
          '---',
          'title: Atomic Block Caret Navigation',
          '---',
          '',
          'After frontmatter keyboard sentinel',
          '',
          'Before toc keyboard sentinel',
          '',
          '[TOC]',
          '',
          'After toc keyboard sentinel',
          '',
          'Before table keyboard sentinel',
          '',
          '| Key | Value |',
          '| --- | --- |',
          '| Table keyboard sentinel | Covered |',
          '',
          'After table keyboard sentinel',
          '',
          'Before math keyboard sentinel',
          '',
          '$$',
          'E = mc^2',
          '$$',
          '',
          'After math keyboard sentinel',
          '',
          'Before diagram keyboard sentinel',
          '',
          '```mermaid',
          'flowchart TD',
          '  A --> B',
          '```',
          '',
          'After diagram keyboard sentinel',
          '',
          'Before hr keyboard sentinel',
          '',
          '---',
          '',
          'After hr keyboard sentinel',
          '',
          'Before code keyboard sentinel',
          '',
          '```ts',
          'const codeKeyboardSentinel = true;',
          '```',
          '',
          'After code keyboard sentinel',
          '',
          'Before image keyboard sentinel',
          '',
          `![Keyboard image sentinel](${TINY_PNG_DATA_URL})`,
          '',
          'After image keyboard sentinel',
          '',
          'Before video keyboard sentinel',
          '',
          '![Keyboard video sentinel](https://example.com/video.mp4)',
          '',
          'After video keyboard sentinel',
          '',
          'Before html keyboard sentinel',
          '',
          '<div>HTML keyboard block sentinel</div>',
          '',
          'After html keyboard sentinel',
        ].join('\n'),
      });

      await expect(page.locator(`${EDITOR_SELECTOR} .frontmatter-block-container, ${EDITOR_SELECTOR} div[data-type="frontmatter"]`)).toHaveCount(1);
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="toc"]`)).toHaveCount(1);
      await expect(page.locator(`${EDITOR_SELECTOR} table`, { hasText: 'Table keyboard sentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="math-block"]`)).toHaveCount(1);
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="mermaid"]`)).toHaveCount(1);
      await expect(page.locator(`${EDITOR_SELECTOR} [data-type="hr"]`)).toHaveCount(1);
      await expect(page.locator(`${EDITOR_SELECTOR} .code-block-container`, { hasText: 'codeKeyboardSentinel' })).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} .image-block-container[data-alt="Keyboard image sentinel"]`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="video"]`)).toHaveCount(1);
      await expect(page.locator(`${EDITOR_SELECTOR} .md-htmlblock, ${EDITOR_SELECTOR} .md-htmlblock-container`, { hasText: 'HTML keyboard block sentinel' })).toBeVisible();

      const selectText = async (text: string) => {
        const selected = await page.evaluate(
          (targetText) => (window as any).__vlainaE2E.selectEditorTextByText(targetText, targetText),
          text,
        );
        expect(selected.selected).toBe(true);
        return selected as { from: number; to: number };
      };

      const assertOnlyCollapsedTextSelection = async (label: string) => {
        await waitForEditorAnimationFrame(page);
        await waitForEditorAnimationFrame(page);
        await expect(page.locator(SELECTED_BLOCK_SELECTOR)).toHaveCount(0);
        const selectedNodes = await page.locator(SELECTED_NODE_SELECTOR).evaluateAll((nodes) =>
          nodes.map((node) => ({
            tagName: node instanceof HTMLElement ? node.tagName : '',
            className: node instanceof HTMLElement ? node.className : '',
            dataType: node instanceof HTMLElement ? node.dataset.type ?? '' : '',
            text: node.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? '',
          }))
        );
        expect(selectedNodes, label).toEqual([]);
        await expect.poll(
          async () => page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary()),
          { timeout: 5_000 },
        ).toMatchObject({
          empty: true,
          selectedText: '',
        });
      };

      const moveDownFrom = async (text: string) => {
        const selected = await selectText(text);
        await page.keyboard.press('ArrowRight');
        await expect.poll(
          async () => page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary()),
          { timeout: 5_000 },
        ).toMatchObject({ empty: true, from: selected.to });
        await page.keyboard.press('ArrowDown');
        await assertOnlyCollapsedTextSelection(`ArrowDown from ${text}`);
      };

      const moveUpFrom = async (text: string) => {
        const selected = await selectText(text);
        await page.keyboard.press('ArrowLeft');
        await expect.poll(
          async () => page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary()),
          { timeout: 5_000 },
        ).toMatchObject({ empty: true, from: selected.from });
        await page.keyboard.press('ArrowUp');
        await assertOnlyCollapsedTextSelection(`ArrowUp from ${text}`);
      };

      for (const [beforeText, afterText] of [
        ['Before toc keyboard sentinel', 'After toc keyboard sentinel'],
        ['Before table keyboard sentinel', 'After table keyboard sentinel'],
        ['Before math keyboard sentinel', 'After math keyboard sentinel'],
        ['Before diagram keyboard sentinel', 'After diagram keyboard sentinel'],
        ['Before hr keyboard sentinel', 'After hr keyboard sentinel'],
        ['Before code keyboard sentinel', 'After code keyboard sentinel'],
        ['Before image keyboard sentinel', 'After image keyboard sentinel'],
        ['Before video keyboard sentinel', 'After video keyboard sentinel'],
        ['Before html keyboard sentinel', 'After html keyboard sentinel'],
      ] as Array<[string, string]>) {
        await moveDownFrom(beforeText);
        await moveUpFrom(afterText);
      }

      await moveUpFrom('After frontmatter keyboard sentinel');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
