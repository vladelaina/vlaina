import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  createVaultFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openAbsoluteNote,
  openMarkdownFixture,
  openVaultInNotes,
  waitForEditorAnimationFrame,
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

async function expectDiskContentAfterSave(
  page: Page,
  notePath: string,
  expected: string,
): Promise<void> {
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

async function expectLiteralBackslashLineVisible(page: Page): Promise<void> {
  await expect.poll(
    async () => {
      const state = await readLiveEditorLineBreakState(page);
      return state.paragraphTexts.filter((text) => text.length > 0);
    },
    { timeout: 10_000 },
  ).toEqual(['\\', '下一行']);

  const state = await readLiveEditorLineBreakState(page);
  expect(state.textContent).toContain('\\下一行');
}

async function expectVisibleMarkdownBlankLineCount(page: Page, expected: number): Promise<void> {
  await expect.poll(
    async () => page.locator(EDITOR_SELECTOR).evaluate((editor) =>
      editor.querySelectorAll([
        '[data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"]',
        'p.editor-editable-markdown-blank-line',
        'p:empty',
      ].join(', ')).length
    ),
    { timeout: 10_000 },
  ).toBe(expected);
}

async function readTerminalBlankLineAudit(page: Page, tailText: string): Promise<{
  content: string;
  directChildren: Array<{
    tagName: string;
    text: string;
    className: string;
    dataType: string;
    dataValue: string;
    isBlankLine: boolean;
  }>;
  terminalBlankCount: number;
}> {
  return page.locator(EDITOR_SELECTOR).evaluate((editor, expectedTailText) => {
    const isBlankLineElement = (element: Element) => {
      if (element.matches('[data-type="html-block"][data-value="<!--vlaina-markdown-blank-line-->"]')) {
        return true;
      }
      if (element.matches('p.editor-editable-markdown-blank-line, p.editor-empty-paragraph, p:empty')) {
        return true;
      }
      return (element.textContent ?? '').trim() === '' && element.tagName === 'P';
    };
    const children = Array.from(editor.children);
    const tailIndex = children.findIndex((element) =>
      (element.textContent ?? '').includes(expectedTailText)
    );
    const trailingChildren = tailIndex >= 0 ? children.slice(tailIndex + 1) : [];

    return {
      content: String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? ''),
      directChildren: children.map((element) => ({
        tagName: element.tagName,
        text: element.textContent ?? '',
        className: element.getAttribute('class') ?? '',
        dataType: element.getAttribute('data-type') ?? '',
        dataValue: element.getAttribute('data-value') ?? '',
        isBlankLine: isBlankLineElement(element),
      })),
      terminalBlankCount: trailingChildren.filter(isBlankLineElement).length,
    };
  }, tailText);
}

async function focusEditorTextEnd(page: Page, text: string): Promise<void> {
  const selected = await page.evaluate((targetText) =>
    (window as any).__vlainaE2E.selectEditorTextByText(targetText, targetText), text
  );
  expect(selected).toMatchObject({
    selected: true,
    selectedText: text,
  });
  expect(typeof selected.to).toBe('number');

  const selection = await page.evaluate((position) =>
    (window as any).__vlainaE2E.setEditorSelectionRange(position), selected.to
  );
  expect(selection).toMatchObject({
    empty: true,
    from: selected.to,
    to: selected.to,
  });
  await waitForEditorAnimationFrame(page);
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

  test('keeps a line-start literal backslash and leading blank line stable after save and reopen', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-line-start-backslash-persistence');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const typed = await openMarkdownFixture(page, {
        filename: 'line-start-backslash-typed.md',
        content: '',
      });
      await typeIntoEmptyNote(page, async () => {
        await page.keyboard.insertText('\\');
        await page.keyboard.press('Enter');
        await page.keyboard.insertText('下一行');
      });
      await expectLiteralBackslashLineVisible(page);
      await expectCurrentNoteAndDiskContent(page, typed.notePath, '\\\\\n下一行');
      await openAbsoluteNote(page, typed.notePath);
      await expectLiteralBackslashLineVisible(page);
      await expectCurrentNoteAndDiskContent(page, typed.notePath, '\\\\\n下一行');

      const leadingBlank = await openMarkdownFixture(page, {
        filename: 'leading-blank-line-start-backslash.md',
        content: ['', '\\', '下一行'].join('\n'),
      });
      await expectLiteralBackslashLineVisible(page);
      await expectDiskContentAfterSave(page, leadingBlank.notePath, ['', '\\', '下一行'].join('\n'));
      await openAbsoluteNote(page, leadingBlank.notePath);
      await expectLiteralBackslashLineVisible(page);
      await expectCurrentNoteAndDiskContent(page, leadingBlank.notePath, ['', '\\', '下一行'].join('\n'));
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps leading and repeated markdown blank lines stable after save and reopen', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-leading-blank-line-persistence');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const content = [
        '',
        'Top blank sentinel',
        '',
        'Middle blank sentinel',
        '',
        '',
        'Bottom blank sentinel',
      ].join('\n');
      const fixture = await openMarkdownFixture(page, {
        filename: 'leading-and-repeated-blank-lines.md',
        content,
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Top blank sentinel');
      await expectVisibleMarkdownBlankLineCount(page, 4);
      await expectCurrentNoteAndDiskContent(page, fixture.notePath, content);

      await openAbsoluteNote(page, fixture.notePath);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Bottom blank sentinel');
      await expectVisibleMarkdownBlankLineCount(page, 4);
      await expectCurrentNoteAndDiskContent(page, fixture.notePath, content);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps editor-created terminal blank lines after refocus, save, and note switch', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-terminal-blank-lines-persistence-audit');
    const terminalBlankLineCount = 14;
    const alphaTail = 'Alpha terminal blank tail sentinel';
    const alphaContent = ['Alpha opening sentinel', '', alphaTail].join('\n');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const fixture = await createVaultFilesFixture(page, {
        name: 'terminal-blank-lines-persistence-audit',
        files: [
          { filename: 'alpha-terminal-blank-lines.md', content: alphaContent },
          { filename: 'beta-terminal-blank-lines.md', content: 'Beta switch sentinel' },
        ],
      });
      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Terminal Blank Lines Persistence Audit',
        minFileCount: 2,
      });
      const alphaPath = fixture.notePaths[0]!;
      const betaPath = fixture.notePaths[1]!;
      await openAbsoluteNote(page, alphaPath);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText(alphaTail);

      await focusEditorTextEnd(page, alphaTail);
      for (let index = 0; index < terminalBlankLineCount; index += 1) {
        await page.keyboard.press('Enter');
      }
      await waitForEditorAnimationFrame(page);

      await expect.poll(() => readTerminalBlankLineAudit(page, alphaTail), { timeout: 10_000 })
        .toMatchObject({ terminalBlankCount: terminalBlankLineCount });

      await focusEditorTextEnd(page, 'Alpha opening sentinel');

      await expect.poll(() => readTerminalBlankLineAudit(page, alphaTail), { timeout: 10_000 })
        .toMatchObject({ terminalBlankCount: terminalBlankLineCount });

      const expectedAlphaContent = `${alphaContent}${'\n'.repeat(terminalBlankLineCount)}`;
      await page.evaluate(() => (window as any).__vlainaE2E.flushCurrentEditorMarkdown());
      await expect.poll(() => readTerminalBlankLineAudit(page, alphaTail), { timeout: 10_000 })
        .toMatchObject({
          content: expectedAlphaContent,
          terminalBlankCount: terminalBlankLineCount,
        });

      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      await expect.poll(async () => page.evaluate((pathToRead) =>
        (window as any).__vlainaE2E.readTextFile(pathToRead), alphaPath
      ), { timeout: 10_000 }).toBe(expectedAlphaContent);

      await openAbsoluteNote(page, betaPath);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Beta switch sentinel');
      await openAbsoluteNote(page, alphaPath);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText(alphaTail);
      await expect.poll(() => readTerminalBlankLineAudit(page, alphaTail), { timeout: 10_000 })
        .toMatchObject({
          content: expectedAlphaContent,
          terminalBlankCount: terminalBlankLineCount,
        });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
