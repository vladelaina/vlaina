import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

const NORMAL_TEXT = 'normal-line-0123456789-sentinel';
const CODE_TEXT = 'code-line-0123456789-sentinel';
const CARET_OFFSET = 12;

async function setCodeCaret(page: Page, offset: number) {
  const codeLine = page.locator(`${EDITOR_SELECTOR} .code-block-container .cm-line`).first();
  await codeLine.click();
  await page.keyboard.press('Home');
  for (let index = 0; index < offset; index += 1) {
    await page.keyboard.press('ArrowRight');
  }
}

async function getCodeSelection(page: Page) {
  return page.locator(`${EDITOR_SELECTOR} .code-block-container .cm-editor`).first().evaluate((editor) => ({
    active: editor.classList.contains('editor-code-selection-active'),
    empty: editor.getAttribute('data-e2e-selection-from') === editor.getAttribute('data-e2e-selection-to'),
    selectedText: editor.getAttribute('data-e2e-selection-text') ?? '',
    visualText: Array.from(
      editor.querySelectorAll<HTMLElement>('.editor-code-selection-text'),
    ).map((element) => element.textContent ?? '').join(''),
  }));
}

test('keeps Ctrl+Shift vertical selection consistent in normal text and code blocks', async () => {
  const { app, userDataRoot } = await launchIsolatedElectron('notes-ctrl-shift-selection');

  try {
    await app.firstWindow();
    const [page] = await getOpenBridgePages(app, 1);
    await openMarkdownFixture(page, {
      filename: 'ctrl-shift-selection.md',
      content: [NORMAL_TEXT, '', '```ts', CODE_TEXT, '```'].join('\n'),
    });

    const normalRange = await page.evaluate(
      (text) => (window as any).__vlainaE2E.selectEditorTextByText(text),
      NORMAL_TEXT,
    );
    expect(normalRange.from).not.toBeNull();
    const normalCaret = Number(normalRange.from) + CARET_OFFSET;
    await page.evaluate(
      (position) => (window as any).__vlainaE2E.setEditorSelectionRange(position),
      normalCaret,
    );

    await page.keyboard.press('Control+Shift+ArrowUp');
    await waitForEditorAnimationFrame(page);

    const normalSelection = await page.evaluate(() => ({
      selection: (window as any).__vlainaE2E.getEditorSelectionSummary(),
      activeIsTitle: document.activeElement?.getAttribute('data-note-title-input') === 'true',
    }));
    expect(normalSelection.activeIsTitle).toBe(false);
    expect(normalSelection.selection).toMatchObject({
      empty: false,
      from: normalRange.from,
      to: normalCaret,
      selectedText: NORMAL_TEXT.slice(0, CARET_OFFSET),
    });

    await setCodeCaret(page, CARET_OFFSET);
    await page.keyboard.press('Control+Shift+ArrowUp');
    await waitForEditorAnimationFrame(page);
    await expect.poll(() => getCodeSelection(page)).toEqual({
      active: true,
      empty: false,
      selectedText: CODE_TEXT.slice(0, CARET_OFFSET),
      visualText: CODE_TEXT.slice(0, CARET_OFFSET),
    });

    await setCodeCaret(page, CARET_OFFSET);
    await page.keyboard.press('Control+ArrowUp');
    await waitForEditorAnimationFrame(page);
    await expect.poll(() => getCodeSelection(page)).toEqual({
      active: false,
      empty: true,
      selectedText: '',
      visualText: '',
    });

    await setCodeCaret(page, CARET_OFFSET);
    await page.keyboard.press('Control+Shift+ArrowDown');
    await waitForEditorAnimationFrame(page);
    await expect.poll(() => getCodeSelection(page)).toEqual({
      active: true,
      empty: false,
      selectedText: CODE_TEXT.slice(CARET_OFFSET),
      visualText: CODE_TEXT.slice(CARET_OFFSET),
    });
  } finally {
    await cleanupIsolatedElectron(app, userDataRoot);
  }
});
