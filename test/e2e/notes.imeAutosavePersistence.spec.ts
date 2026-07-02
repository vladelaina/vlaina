import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openAbsoluteNote,
  openMarkdownFixture,
} from './notesE2E';

async function readCurrentNoteContent(page: Page): Promise<string> {
  return page.evaluate(() =>
    String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
  );
}

async function readDiskContent(page: Page, notePath: string): Promise<string> {
  return page.evaluate((pathToRead) =>
    (window as any).__vlainaE2E.readTextFile(pathToRead), notePath
  );
}

async function dispatchImeComposition(
  page: Page,
  input: {
    romanizedText: string;
  },
): Promise<void> {
  const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
  expect(focused).toBe(true);

  const started = await page.evaluate(({ editorSelector, romanizedText }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) return false;

    editor.dispatchEvent(new CompositionEvent('compositionstart', {
      bubbles: true,
      data: '',
    }));
    editor.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data: romanizedText,
      inputType: 'insertCompositionText',
      isComposing: true,
    }));
    return true;
  }, { editorSelector: EDITOR_SELECTOR, romanizedText: input.romanizedText });
  expect(started).toBe(true);

  await page.keyboard.insertText(input.romanizedText);
  await expect(page.locator(EDITOR_SELECTOR)).toContainText(input.romanizedText);
}

async function finishImeComposition(
  page: Page,
  committedText: string,
): Promise<void> {
  await page.evaluate(({ editorSelector, committedText }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) {
      throw new Error('Editor was not mounted');
    }

    editor.dispatchEvent(new CompositionEvent('compositionend', {
      bubbles: true,
      data: committedText,
    }));
  }, { editorSelector: EDITOR_SELECTOR, committedText });
}

function expectCommittedWithoutRomanized(content: string): void {
  expect(content).toContain('你好');
  expect(content).not.toContain('nihao');
}

test.describe('notes IME autosave persistence', () => {
  test.setTimeout(90_000);

  test('does not persist romanized composition text before committed Chinese is saved', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-ime-autosave-persistence');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const opened = await openMarkdownFixture(page, {
        filename: 'ime-autosave.md',
        content: '',
      });

      await dispatchImeComposition(page, {
        romanizedText: 'nihao',
      });

      await page.waitForTimeout(1500);
      expect(await readCurrentNoteContent(page)).toBe('');
      expect(await readDiskContent(page, opened.notePath)).toBe('');

      await finishImeComposition(page, '你好');

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('你好');
      await expect(page.locator(EDITOR_SELECTOR)).not.toContainText('nihao');
      await expect.poll(async () => {
        const content = await readCurrentNoteContent(page);
        return {
          hasCommittedText: content.includes('你好'),
          hasRomanizedText: content.includes('nihao'),
        };
      }, { timeout: 10_000 }).toEqual({
        hasCommittedText: true,
        hasRomanizedText: false,
      });
      await expect.poll(async () => {
        const content = await readDiskContent(page, opened.notePath);
        return {
          hasCommittedText: content.includes('你好'),
          hasRomanizedText: content.includes('nihao'),
        };
      }, { timeout: 10_000 }).toEqual({
        hasCommittedText: true,
        hasRomanizedText: false,
      });

      await openAbsoluteNote(page, opened.notePath);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('你好');
      await expect(page.locator(EDITOR_SELECTOR)).not.toContainText('nihao');
      expectCommittedWithoutRomanized(await readCurrentNoteContent(page));
      expectCommittedWithoutRomanized(await readDiskContent(page, opened.notePath));
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
