import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openAbsoluteNote,
  openMarkdownFixture,
} from './notesE2E';

async function typeIntoEmptyNote(page: Page, actions: () => Promise<void>): Promise<void> {
  await page.locator(EDITOR_SELECTOR).click({ position: { x: 24, y: 24 } });
  await actions();
}

async function expectCurrentNoteAndDiskContent(
  page: Page,
  notePath: string,
  expected: string,
): Promise<void> {
  await expect.poll(async () => page.evaluate(() =>
    String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
  ), { timeout: 10_000 }).toBe(expected);
  await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
  await expect.poll(async () => page.evaluate((pathToRead) =>
    (window as any).__vlainaE2E.readTextFile(pathToRead), notePath
  ), { timeout: 10_000 }).toBe(expected);
}

async function readLiveEditorLineBreakState(page: Page): Promise<{
  textContent: string;
  innerText: string;
  paragraphTexts: string[];
  html: string;
  content: string;
}> {
  return page.evaluate(() => {
    const editor = document.querySelector('.milkdown .ProseMirror') as HTMLElement | null;
    return {
      textContent: editor?.textContent ?? '',
      innerText: editor?.innerText ?? '',
      paragraphTexts: Array.from(editor?.querySelectorAll('p') ?? [])
        .map((paragraph) => paragraph.textContent ?? ''),
      html: editor?.innerHTML ?? '',
      content: String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? ''),
    };
  });
}

async function expectOrdinaryEnterVisibleWithoutHardBreak(page: Page): Promise<void> {
  await expect.poll(() => readLiveEditorLineBreakState(page), { timeout: 10_000 }).toMatchObject({
    paragraphTexts: ['1', '2'],
  });

  const state = await readLiveEditorLineBreakState(page);
  expect(state.textContent).not.toContain('\\');
  expect(state.innerText).not.toContain('\\');
  expect(state.paragraphTexts.join('\n')).toBe('1\n2');
  expect(state.html).not.toContain('>\\');
  expect(state.content).not.toContain('\\');
}

test.describe('notes line break persistence', () => {
  test.setTimeout(90_000);

  test('persists ordinary Enter as a single newline and Shift+Enter as a markdown hard break', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-line-break-persistence');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const ordinary = await openMarkdownFixture(page, {
        filename: 'line-break-enter.md',
        content: '',
      });
      await typeIntoEmptyNote(page, async () => {
        await page.keyboard.type('1');
        await expect.poll(() => readLiveEditorLineBreakState(page), { timeout: 10_000 }).toMatchObject({
          paragraphTexts: ['1'],
        });
        await page.keyboard.press('Enter');
        await expect.poll(() => readLiveEditorLineBreakState(page), { timeout: 10_000 }).toMatchObject({
          paragraphTexts: ['1', ''],
        });
        await page.keyboard.type('2');
      });
      await expectOrdinaryEnterVisibleWithoutHardBreak(page);
      await expectCurrentNoteAndDiskContent(page, ordinary.notePath, '1\n2');
      await expectOrdinaryEnterVisibleWithoutHardBreak(page);
      await openAbsoluteNote(page, ordinary.notePath);
      await expectOrdinaryEnterVisibleWithoutHardBreak(page);

      const explicitBlankLine = await openMarkdownFixture(page, {
        filename: 'line-break-double-enter.md',
        content: '',
      });
      await typeIntoEmptyNote(page, async () => {
        await page.keyboard.type('1');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await page.keyboard.type('2');
      });
      await expectCurrentNoteAndDiskContent(page, explicitBlankLine.notePath, '1\n\n2');

      const softBreak = await openMarkdownFixture(page, {
        filename: 'line-break-shift-enter.md',
        content: '',
      });
      await typeIntoEmptyNote(page, async () => {
        await page.keyboard.type('1');
        await page.keyboard.press('Shift+Enter');
        await page.keyboard.type('2');
      });
      await expectCurrentNoteAndDiskContent(page, softBreak.notePath, '1\\\n2');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
