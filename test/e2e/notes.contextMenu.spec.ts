import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

const CONTEXT_MENU_SELECTOR = '.editor-context-menu:not(.editor-context-menu-submenu)';
const SOURCE_EDITOR_SELECTOR = '[data-note-source-editor="true"]';
const SOURCE_SHORTCUT = process.platform === 'darwin' ? 'Meta+/' : 'Control+/';
const MODIFIER = process.platform === 'darwin' ? 'Meta' : 'Control';

async function selectSourceText(source: Locator, text: string) {
  await source.evaluate((element, selectedText) => {
    const textarea = element as HTMLTextAreaElement;
    const start = textarea.value.indexOf(selectedText);
    if (start < 0) throw new Error(`Source text not found: ${selectedText}`);
    textarea.setSelectionRange(start, start + selectedText.length);
  }, text);
}

async function openSourceContextMenu(source: Locator) {
  await source.click({ button: 'right', position: { x: 40, y: 20 } });
}

async function placeSourceCaret(source: Locator, text: string, offset = text.length) {
  await source.evaluate((element, caretTarget) => {
    const textarea = element as HTMLTextAreaElement;
    const start = textarea.value.indexOf(caretTarget.text);
    if (start < 0) throw new Error(`Source text not found: ${caretTarget.text}`);
    const caret = start + caretTarget.offset;
    textarea.setSelectionRange(caret, caret);
  }, { text, offset });
}

async function openRichContextMenuAtTextCaret(page: Page, text: string) {
  const range = await page.evaluate((target) => (window as any).__vlainaE2E.getEditorTextRange(target), text);
  expect(range).not.toBeNull();
  await page.evaluate(async (position) => {
    await (window as any).__vlainaE2E.setEditorSelectionRange(position, position);
    document.querySelector('.milkdown .ProseMirror')?.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: -1000,
      clientY: -1000,
    }));
  }, range!.from);
}

test('opens the Notes context menu and runs rich/source clipboard actions', async () => {
  const { app, userDataRoot } = await launchIsolatedElectron('notes-context-menu');

  try {
    await app.firstWindow();
    const [page] = await getOpenBridgePages(app, 1);
    await page.setViewportSize({ width: 1280, height: 860 });
    await openMarkdownFixture(page, {
      filename: 'context-menu.md',
      content: '# Context Menu\n\nSelected rich text sentinel.\n\nSource sentinel.',
    });

    const selected = await page.evaluate(() => (
      (window as any).__vlainaE2E.selectEditorTextByText('Selected rich text sentinel.')
    ));
    expect(selected.selectedText).toBe('Selected rich text sentinel.');
    await page.keyboard.press(`${MODIFIER}+Shift+C`);
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
      .toBe('Selected rich text sentinel.');
    const richText = page.getByText('Selected rich text sentinel.', { exact: true });
    await richText.click({ button: 'right' });

    const menu = page.locator(CONTEXT_MENU_SELECTOR);
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Copy', exact: true }).click();
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
      .toBe('Selected rich text sentinel.');

    await page.keyboard.press(SOURCE_SHORTCUT);
    const source = page.locator(SOURCE_EDITOR_SELECTOR);
    await expect(source).toBeVisible();
    await source.evaluate((element) => {
      const textarea = element as HTMLTextAreaElement;
      const start = textarea.value.indexOf('Source sentinel.');
      textarea.setSelectionRange(start, start + 'Source sentinel.'.length);
    });
    await source.click({ button: 'right', position: { x: 40, y: 20 } });
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Copy', exact: true }).click();
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
      .toBe('Source sentinel.');

    await app.evaluate(({ clipboard }) => clipboard.writeText(' pasted from context menu'));
    await source.evaluate((element) => {
      const textarea = element as HTMLTextAreaElement;
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
    await source.click({ button: 'right', position: { x: 40, y: 20 } });
    await menu.getByRole('menuitem', { name: 'Paste', exact: true }).click();
    await expect(source).toHaveValue(/ pasted from context menu$/);
  } finally {
    await cleanupIsolatedElectron(app, userDataRoot);
  }
});

test('keeps table and preview right-click menus ahead of the general editor menu', async () => {
  const { app, userDataRoot } = await launchIsolatedElectron('notes-context-menu-specialized');

  try {
    await app.firstWindow();
    const [page] = await getOpenBridgePages(app, 1);
    await page.setViewportSize({ width: 1280, height: 860 });
    await openMarkdownFixture(page, {
      filename: 'context-menu-specialized.md',
      content: [
        '# Specialized Menus',
        '',
        '| First | Second |',
        '| --- | --- |',
        '| Alpha | Beta |',
        '',
        '$$',
        'E = mc^2',
        '$$',
      ].join('\n'),
    });

    const cell = page.locator(`${EDITOR_SELECTOR} td`).first();
    await cell.scrollIntoViewIfNeeded();
    const cellBox = await cell.boundingBox();
    expect(cellBox).not.toBeNull();
    const tablePoint = { x: cellBox!.x + cellBox!.width / 2, y: cellBox!.y + cellBox!.height / 2 };
    await page.evaluate((point) => { (window as any).__contextMenuTestPoint = point; }, tablePoint);
    await page.mouse.click(tablePoint.x, tablePoint.y, { button: 'right' });
    const tableMenus = await page.evaluate(() => ({
      general: document.querySelectorAll('.editor-context-menu:not(.editor-context-menu-submenu)').length,
      focused: document.activeElement?.outerHTML.slice(0, 200) ?? null,
      table: document.querySelectorAll('.table-context-menu').length,
      preview: document.querySelectorAll('.editor-preview-context-menu').length,
      shortcuts: Array.from(document.querySelectorAll('.table-context-menu .table-menu-shortcut')).map((element) => element.textContent),
      target: document.elementFromPoint(
        (window as any).__contextMenuTestPoint?.x ?? 0,
        (window as any).__contextMenuTestPoint?.y ?? 0,
      )?.outerHTML.slice(0, 500) ?? null,
    }));
    expect(tableMenus).toMatchObject({
      general: 0,
      table: 1,
      preview: 0,
      shortcuts: expect.arrayContaining(
        MODIFIER === 'Meta' ? ['⌘Enter', '⌘⇧Backspace'] : ['Ctrl+Enter', 'Ctrl+Shift+Backspace'],
      ),
    });
    await expect(page.locator(CONTEXT_MENU_SELECTOR)).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.locator(`${EDITOR_SELECTOR} [data-type="math-block"]`).click({ button: 'right' });
    await expect(page.locator('.editor-preview-context-menu')).toBeVisible();
    await expect(page.locator(CONTEXT_MENU_SELECTOR)).toHaveCount(0);
  } finally {
    await cleanupIsolatedElectron(app, userDataRoot);
  }
});

test('shows icon tooltips and runs source formatting, paragraph, insert, cut, and delete actions', async () => {
  const { app, userDataRoot } = await launchIsolatedElectron('notes-context-menu-actions');

  try {
    await app.firstWindow();
    const [page] = await getOpenBridgePages(app, 1);
    await page.setViewportSize({ width: 1280, height: 860 });
    await openMarkdownFixture(page, {
      filename: 'context-menu-actions.md',
      content: [
        '# Context Menu Actions',
        '',
        'Tooltip caret line.',
        'Bold target.',
        'Heading target.',
        'Cut target.',
        'Delete target.',
        'Shortcut quote target.',
        'Shortcut task target.',
      ].join('\n'),
    });

    await page.keyboard.press(SOURCE_SHORTCUT);
    const source = page.locator(SOURCE_EDITOR_SELECTOR);
    const menu = page.locator(CONTEXT_MENU_SELECTOR);
    await expect(source).toBeVisible();

    const tooltipCaret = await source.evaluate((element) => (
      (element as HTMLTextAreaElement).value.indexOf('Tooltip caret line.')
    ));
    await source.evaluate((element, caret) => {
      const textarea = element as HTMLTextAreaElement;
      textarea.setSelectionRange(caret, caret);
    }, tooltipCaret);
    await openSourceContextMenu(source);
    const cut = menu.getByRole('menuitem', { name: 'Cut', exact: true });
    await expect(cut).toBeDisabled();
    await cut.locator('..').hover();
    const tooltip = page.locator('[role="tooltip"]:visible');
    await expect(tooltip).toContainText('Cut');
    await expect(tooltip).toContainText(MODIFIER === 'Meta' ? '⌘X' : 'Ctrl+X');
    await page.keyboard.press('Escape');

    await selectSourceText(source, 'Bold target.');
    await openSourceContextMenu(source);
    await menu.getByRole('menuitem', { name: 'Bold', exact: true }).locator('..').hover();
    await expect(tooltip).toContainText('Bold');
    await expect(tooltip).toContainText(MODIFIER === 'Meta' ? '⌘B' : 'Ctrl+B');
    await menu.getByRole('menuitem', { name: 'Bold', exact: true }).click();
    await expect(source).toHaveValue(/\*\*Bold target\.\*\*/);

    for (const [label, shortcut] of [
      ['Underline', MODIFIER === 'Meta' ? '⌘U' : 'Ctrl+U'],
      ['Strikethrough', MODIFIER === 'Meta' ? '⌘⇧5' : 'Ctrl+Shift+5'],
      ['Highlight', MODIFIER === 'Meta' ? '⌘H' : 'Ctrl+H'],
    ] as const) {
      await openSourceContextMenu(source);
      await menu.getByRole('menuitem', { name: label, exact: true }).locator('..').hover();
      await expect(tooltip).toContainText(label);
      await expect(tooltip).toContainText(shortcut);
      await page.keyboard.press('Escape');
    }

    await selectSourceText(source, 'Heading target.');
    await openSourceContextMenu(source);
    await menu.getByRole('menuitem', { name: 'Paragraph', exact: true }).click();
    const paragraphMenu = page.locator('.editor-context-menu-submenu');
    await paragraphMenu.getByRole('menuitemradio', { name: 'Heading 2', exact: true }).click();
    await expect(source).toHaveValue(/^## Heading target\.$/m);

    const insertionCaret = await source.evaluate((element) => (
      (element as HTMLTextAreaElement).value.length
    ));
    await source.evaluate((element, caret) => {
      const textarea = element as HTMLTextAreaElement;
      textarea.setSelectionRange(caret, caret);
    }, insertionCaret);
    await openSourceContextMenu(source);
    await menu.getByRole('menuitem', { name: 'Insert', exact: true }).click();
    await page.locator('.editor-context-menu-submenu').getByRole('menuitem', { name: 'Divider', exact: true }).click();
    await expect(source).toHaveValue(/\n---\n$/);

    await selectSourceText(source, 'Cut target.');
    await openSourceContextMenu(source);
    await menu.getByRole('menuitem', { name: 'Cut', exact: true }).click();
    await expect(source).not.toHaveValue(/Cut target\./);
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe('Cut target.');

    await selectSourceText(source, 'Delete target.');
    await openSourceContextMenu(source);
    await menu.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await expect(source).not.toHaveValue(/Delete target\./);

    await selectSourceText(source, 'Shortcut quote target.');
    await source.press(`${MODIFIER}+Shift+Q`);
    await expect(source).toHaveValue(/^> Shortcut quote target\.$/m);

    await selectSourceText(source, 'Shortcut task target.');
    await source.press(`${MODIFIER}+Shift+X`);
    await expect(source).toHaveValue(/^- \[ \] Shortcut task target\.$/m);

    await selectSourceText(source, '**Bold target.**');
    await source.press(`${MODIFIER}+Shift+C`);
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
      .toBe('**Bold target.**');

    await app.evaluate(({ clipboard }) => clipboard.writeText(' plain shortcut paste'));
    const pasteCaret = await source.evaluate((element) => (element as HTMLTextAreaElement).value.length);
    await source.evaluate((element, caret) => {
      const textarea = element as HTMLTextAreaElement;
      textarea.setSelectionRange(caret, caret);
    }, pasteCaret);
    await source.press(`${MODIFIER}+Shift+V`);
    await expect(source).toHaveValue(/ plain shortcut paste$/);
  } finally {
    await cleanupIsolatedElectron(app, userDataRoot);
  }
});

test('formats caret input and exposes every editor insert command', async () => {
  const { app, userDataRoot } = await launchIsolatedElectron('notes-context-menu-completeness');

  try {
    await app.firstWindow();
    const [page] = await getOpenBridgePages(app, 1);
    await page.setViewportSize({ width: 1280, height: 860 });
    await openMarkdownFixture(page, {
      filename: 'context-menu-completeness.md',
      content: [
        '# Context Menu Completeness',
        '',
        'Bold caret.',
        '',
        'Italic caret.',
        '',
        'Code caret.',
        '',
        'Source caret.',
      ].join('\n'),
    });

    const menu = page.locator(CONTEXT_MENU_SELECTOR);
    for (const [target, action, typed, mark] of [
      ['Bold caret.', 'Bold', 'boldtyped', 'strong'],
      ['Italic caret.', 'Italic', 'italictyped', 'emphasis'],
      ['Code caret.', 'Inline code', 'codetyped', 'inlineCode'],
    ] as const) {
      await openRichContextMenuAtTextCaret(page, target);
      await expect(menu).toBeVisible();
      await menu.getByRole('menuitem', { name: action, exact: true }).click();
      await page.keyboard.type(typed);
      await expect.poll(() => page.evaluate(({ text, markName }) => (
        (window as any).__vlainaE2E.editorTextHasMark(text, markName)
      ), { text: typed, markName: mark })).toBe(true);
    }

    await page.keyboard.press(SOURCE_SHORTCUT);
    const source = page.locator(SOURCE_EDITOR_SELECTOR);
    await expect(source).toBeVisible();
    await placeSourceCaret(source, 'Source caret.');
    await openSourceContextMenu(source);
    await menu.getByRole('menuitem', { name: 'Bold', exact: true }).click();
    await source.pressSequentially('sourcebold');
    await expect(source).toHaveValue(/Source caret\.\*\*sourcebold\*\*/);

    await openSourceContextMenu(source);
    await expect(menu.getByRole('menuitem', { name: 'Bold', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await menu.getByRole('menuitem', { name: 'Insert', exact: true }).click();
    const insertMenu = page.locator('.editor-context-menu-submenu');
    await expect(insertMenu.getByRole('menuitem')).toHaveCount(19);
    expect(await insertMenu.getByRole('menuitem').evaluateAll((items) => (
      items.map((item) => item.getAttribute('aria-label'))
    ))).toEqual([
      'Image',
      'Table',
      'Code Block',
      'Divider',
      'Callout',
      'Emoji',
      'Equation',
      'Inline Math',
      'Footnote',
      'Footnote Definition',
      'Link reference',
      'Table of Contents',
      'Mermaid Diagram',
      'HTML Block',
      'Video',
      'Abbreviation',
      'YAML Front Matter',
      'Insert paragraph (Above)',
      'Insert paragraph (Below)',
    ]);
  } finally {
    await cleanupIsolatedElectron(app, userDataRoot);
  }
});
