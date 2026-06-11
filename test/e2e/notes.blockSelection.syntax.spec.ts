import { expect, test } from "@playwright/test";
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from "./notesE2E";
import {
  MARKDOWN_DRAG_SYNTAX_CASES,
  dragVisibleHandleAndMeasure,
  expectSyntaxHandleGeometry,
  expectTransparentDragVisual,
  locateSyntaxTarget,
  measureSyntaxHandleGeometry,
  moveMouseToSyntaxHandleGutter,
  selectSyntaxDragCase,
  type MarkdownDragSyntaxCase,
  type SyntaxHandleGeometry,
} from "./notesBlockSelectionDragHelpers";
import { createMarkdownSyntaxFixture } from "./notesMarkdownSyntaxFixture";
import { selectNoteBlocksByMatchers } from "./notesBlockSelectionShared";

test.describe("notes block selection syntax drag", () => {
  test.setTimeout(90_000);

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
});
