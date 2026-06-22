import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';
import { TINY_PNG_DATA_URL } from './notesMarkdownSyntaxFixture';

type TitleArrowDownSyntaxCase = {
  label: string;
  markdown: string;
  expectedText: string;
  anchorText?: string;
};

const TITLE_ARROW_DOWN_SYNTAX_CASES: TitleArrowDownSyntaxCase[] = [
  {
    label: 'heading',
    markdown: '## Heading arrow down target sentinel',
    expectedText: 'Heading arrow down target sentinel',
  },
  {
    label: 'paragraph',
    markdown: 'Plain paragraph arrow down target sentinel',
    expectedText: 'Plain paragraph arrow down target sentinel',
  },
  {
    label: 'inline-marks-and-link',
    markdown: 'Inline **strong arrow down target** and [link tail sentinel](https://example.com)',
    expectedText: 'link tail sentinel',
  },
  {
    label: 'soft-break-paragraph',
    markdown: ['Soft break first line arrow target sentinel', 'soft break second line should not be targeted'].join('\n'),
    expectedText: 'Soft break first line arrow target sentinel',
  },
  {
    label: 'blockquote',
    markdown: '> Blockquote arrow down target sentinel',
    expectedText: 'Blockquote arrow down target sentinel',
  },
  {
    label: 'blockquote-list',
    markdown: '> - Blockquote list arrow target sentinel',
    expectedText: 'Blockquote list arrow target sentinel',
  },
  {
    label: 'bullet-list',
    markdown: ['- Bullet arrow down target sentinel', '- Bullet second line should not be targeted'].join('\n'),
    expectedText: 'Bullet arrow down target sentinel',
  },
  {
    label: 'ordered-list',
    markdown: ['1. Ordered arrow down target sentinel', '2. Ordered second line should not be targeted'].join('\n'),
    expectedText: 'Ordered arrow down target sentinel',
  },
  {
    label: 'parenthesized-ordered-list',
    markdown: ['1) Parenthesized ordered arrow target sentinel', '2) Parenthesized ordered second item'].join('\n'),
    expectedText: 'Parenthesized ordered arrow target sentinel',
  },
  {
    label: 'task-list',
    markdown: ['- [ ] Task arrow down target sentinel', '- [x] Task second line should not be targeted'].join('\n'),
    expectedText: 'Task arrow down target sentinel',
  },
  {
    label: 'nested-list-parent',
    markdown: ['- Parent list arrow down target sentinel', '  - Nested child should not be targeted first'].join('\n'),
    expectedText: 'Parent list arrow down target sentinel',
  },
  {
    label: 'definition-list',
    markdown: ['Definition term arrow target sentinel', ': Definition body should not be targeted first'].join('\n'),
    expectedText: 'Definition term arrow target sentinel',
  },
  {
    label: 'table',
    markdown: [
      '| Table header arrow target sentinel | Status |',
      '| --- | --- |',
      '| Table body should not be targeted first | OK |',
    ].join('\n'),
    expectedText: 'Table header arrow target sentinel',
  },
  {
    label: 'code-block',
    markdown: ['```ts', 'const codeArrowTargetSentinel = true;', '```'].join('\n'),
    expectedText: 'const codeArrowTargetSentinel = true;',
  },
  {
    label: 'inline-math',
    markdown: 'Inline math $a^2 + b^2$ arrow target sentinel',
    expectedText: 'arrow target sentinel',
  },
  {
    label: 'callout',
    markdown: ['> [!note] Callout arrow target sentinel', '> Callout body should not be targeted first'].join('\n'),
    expectedText: 'Callout arrow target sentinel',
  },
  {
    label: 'footnote-reference',
    markdown: ['Footnote reference[^arrow-note] arrow target sentinel', '', '[^arrow-note]: Footnote body sentinel.'].join('\n'),
    expectedText: 'arrow target sentinel',
  },
  {
    label: 'horizontal-rule-before-paragraph',
    markdown: ['---', '', 'Paragraph after rule arrow target sentinel'].join('\n'),
    expectedText: 'Paragraph after rule arrow target sentinel',
  },
  {
    label: 'image-before-paragraph',
    markdown: [`![Image before paragraph](${TINY_PNG_DATA_URL})`, '', 'Paragraph after image arrow target sentinel'].join('\n'),
    expectedText: 'Paragraph after image arrow target sentinel',
  },
];

async function focusTitleAtEnd(page: Page) {
  const titleInput = page.locator('[data-note-title-input="true"]');
  await titleInput.click();
  await page.evaluate(() => {
    const titleInput = document.querySelector<HTMLTextAreaElement>('[data-note-title-input="true"]');
    if (!titleInput) return;
    titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);
  });
  await expect.poll(
    async () => page.evaluate(() => {
      const titleInput = document.querySelector<HTMLTextAreaElement>('[data-note-title-input="true"]');
      return document.activeElement === titleInput;
    }),
    { timeout: 5_000 },
  ).toBe(true);
}

test.describe('notes title keyboard navigation', () => {
  test.setTimeout(240_000);

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

  test('moves from the note title to the first body line end with ArrowDown without changing markdown', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-title-arrow-down-navigation');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const firstBodyLine = 'First body line arrow down sentinel';
      const secondBodyLine = 'Second body line arrow down sentinel';
      const body = [firstBodyLine, secondBodyLine].join('\n');
      await openMarkdownFixture(page, {
        filename: 'title-arrow-down-navigation.md',
        content: body,
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText(firstBodyLine);
      const firstSelected = await page.evaluate(
        (targetText) => (window as any).__vlainaE2E.selectEditorTextByText(targetText, targetText),
        firstBodyLine,
      );
      expect(firstSelected.selected).toBe(true);

      const secondSelected = await page.evaluate(
        (targetText) => (window as any).__vlainaE2E.selectEditorTextByText(targetText, targetText),
        secondBodyLine,
      );
      expect(secondSelected.selected).toBe(true);
      await page.keyboard.press('ArrowLeft');
      await waitForEditorAnimationFrame(page);
      await expect.poll(
        async () => page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary()),
        { timeout: 5_000 },
      ).toMatchObject({
        empty: true,
        from: secondSelected.from,
        to: secondSelected.from,
      });

      const titleInput = page.locator('[data-note-title-input="true"]');
      await titleInput.click();
      await page.evaluate(() => {
        const titleInput = document.querySelector<HTMLTextAreaElement>('[data-note-title-input="true"]');
        if (!titleInput) return;
        titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);
      });
      await expect.poll(
        async () => page.evaluate(() => {
          const titleInput = document.querySelector<HTMLTextAreaElement>('[data-note-title-input="true"]');
          return {
            activeIsTitle: document.activeElement === titleInput,
            selectionStart: titleInput?.selectionStart ?? null,
            selectionEnd: titleInput?.selectionEnd ?? null,
            titleLength: titleInput?.value.length ?? null,
          };
        }),
        { timeout: 5_000 },
      ).toMatchObject({
        activeIsTitle: true,
        selectionStart: expect.any(Number),
        selectionEnd: expect.any(Number),
      });

      await page.keyboard.press('ArrowDown');
      await waitForEditorAnimationFrame(page);

      const state = await page.evaluate(() => {
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        return {
          activeIsEditor: document.activeElement === editor,
          editorSelection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
          content: String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? ''),
        };
      });

      expect(state.activeIsEditor, JSON.stringify(state, null, 2)).toBe(true);
      expect(state.editorSelection).toMatchObject({
        empty: true,
        from: firstSelected.to,
        to: firstSelected.to,
      });
      expect(state.content).toBe(body);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('moves from the note title to the first editable line end across markdown syntax', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-title-arrow-down-syntax-matrix');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      for (const syntaxCase of TITLE_ARROW_DOWN_SYNTAX_CASES) {
        const distractorText = `Distractor paragraph for ${syntaxCase.label} should not keep the caret`;
        const content = [syntaxCase.markdown, '', distractorText].join('\n');
        await openMarkdownFixture(page, {
          filename: `title-arrow-down-${syntaxCase.label}.md`,
          content,
        });
        await expect(page.locator(EDITOR_SELECTOR), syntaxCase.label).toContainText(syntaxCase.expectedText);

        const expected = await page.evaluate(
          ({ targetText, anchorText }) => (
            (window as any).__vlainaE2E.selectEditorTextByText(targetText, anchorText)
          ),
          {
            targetText: syntaxCase.expectedText,
            anchorText: syntaxCase.anchorText ?? syntaxCase.expectedText,
          },
        );
        expect(expected.selected, `${syntaxCase.label}: expected text must be selectable`).toBe(true);

        const distractor = await page.evaluate(
          (targetText) => (window as any).__vlainaE2E.selectEditorTextByText(targetText, targetText),
          distractorText,
        );
        expect(distractor.selected, `${syntaxCase.label}: distractor text must be selectable`).toBe(true);
        await page.keyboard.press('ArrowLeft');
        await waitForEditorAnimationFrame(page);
        await expect.poll(
          async () => page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary()),
          { timeout: 5_000, message: `${syntaxCase.label}: precondition should collapse at distractor` },
        ).toMatchObject({
          empty: true,
          from: distractor.from,
          to: distractor.from,
        });

        await focusTitleAtEnd(page);
        await page.keyboard.press('ArrowDown');
        await waitForEditorAnimationFrame(page);

        await expect.poll(
          async () => page.evaluate(() => (window as any).__vlainaE2E.getEditorSelectionSummary()),
          { timeout: 5_000, message: `${syntaxCase.label}: ArrowDown should target the first editable line end` },
        ).toMatchObject({
          empty: true,
          from: expected.to,
          to: expected.to,
        });

        const savedContent = await page.evaluate(() => String(
          (window as any).__vlainaE2E.getNotesState().currentNote?.content ?? ''
        ));
        expect(savedContent, `${syntaxCase.label}: navigation must not change markdown`).toBe(content);
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
