import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  createNotesRootFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openAbsoluteNote,
  waitForEditorAnimationFrame,
} from './notesE2E';

const TABLE_BLOCK_SELECTOR = `${EDITOR_SELECTOR} .milkdown-table-block`;
const COLUMN_CONTROL_SELECTOR = '[data-role="col-header-drag-control"]';
const ROW_CONTROL_SELECTOR = '[data-role="row-header-drag-control"]';
const COLUMN_MENU_SELECTOR = '[data-role="col-header-drag-menu"]';
const ROW_MENU_SELECTOR = '[data-role="row-header-drag-menu"]';

function createTableMarkdown(): string {
  return [
    '# Table deletion persistence',
    '',
    '| Keep A | Delete column sentinel | Keep C | Keep D |',
    '| --- | --- | --- | --- |',
    '| Row one A | Delete column row one | Row one C | Row one D |',
    '| Delete row sentinel | Delete column row two | Row two C | Row two D |',
    '| Row three A | Delete column row three | Row three C | Row three D |',
    '',
    'After table sentinel.',
  ].join('\n');
}

async function openMathPopup(page: Page, displayMode: 'block' | 'inline') {
  const tagName = displayMode === 'block' ? 'div' : 'span';
  const selector = `${EDITOR_SELECTOR} ${tagName}[data-type="math-${displayMode}"]`;
  const block = page.locator(selector).first();
  await block.scrollIntoViewIfNeeded();
  await page.evaluate((blockSelector) => {
    const target = document.querySelector(blockSelector);
    if (!(target instanceof HTMLElement)) throw new Error('Math block not found');
    const rect = target.getBoundingClientRect();
    const eventInit: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 1,
      clientX: rect.left + Math.min(40, rect.width / 2),
      clientY: rect.top + Math.min(24, rect.height / 2),
      view: window,
    };
    target.dispatchEvent(new MouseEvent('mousedown', eventInit));
    target.dispatchEvent(new MouseEvent('mouseup', { ...eventInit, buttons: 0 }));
    target.dispatchEvent(new MouseEvent('click', { ...eventInit, buttons: 0 }));
  }, selector);

  const textarea = page.locator('.math-editor-popup textarea.text-editor-textarea').first();
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  return textarea;
}

async function expectTableShape(page: Page, rows: number, columns: number) {
  await expect.poll(async () => page.evaluate((tableSelector) => {
    const table = document.querySelector(`${tableSelector} table`);
    const firstRow = table?.querySelector('tr');
    return {
      rows: table?.querySelectorAll('tr').length ?? 0,
      columns: firstRow?.querySelectorAll('th, td').length ?? 0,
    };
  }, TABLE_BLOCK_SELECTOR)).toEqual({ rows, columns });
}

async function openTableHandleMenu(
  page: Page,
  target: 'column' | 'row',
  index: number,
) {
  const point = await page.evaluate(({ tableSelector, targetType, targetIndex }) => {
    const table = document.querySelector(`${tableSelector} table`);
    const rows = table?.querySelectorAll<HTMLTableRowElement>('tr');
    const cell = targetType === 'column'
      ? rows?.[0]?.querySelectorAll<HTMLElement>('th, td')[targetIndex]
      : rows?.[targetIndex]?.querySelector<HTMLElement>('th, td');
    if (!cell) return null;
    cell.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = cell.getBoundingClientRect();
    return targetType === 'column'
      ? { x: rect.left + rect.width / 2, y: rect.top + 2 }
      : { x: rect.left - 4, y: rect.top + rect.height / 2 };
  }, { tableSelector: TABLE_BLOCK_SELECTOR, targetType: target, targetIndex: index });
  expect(point, `Expected ${target} handle point`).not.toBeNull();

  await page.mouse.move(point!.x, point!.y);
  const control = page.locator(
    target === 'column' ? COLUMN_CONTROL_SELECTOR : ROW_CONTROL_SELECTOR,
  ).first();
  await expect(control).toBeVisible({ timeout: 5_000 });
  const box = await control.boundingBox();
  expect(box, `Expected ${target} handle box`).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const menu = page.locator(target === 'column' ? COLUMN_MENU_SELECTOR : ROW_MENU_SELECTOR);
  await expect(menu).toBeVisible({ timeout: 5_000 });
  return menu;
}

test.describe('notes rich block mutation persistence', () => {
  test.setTimeout(180_000);

  test('persists block and inline edits made through existing formula popups', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-formula-edit-persistence');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'formula-edit-persistence',
        files: [
          {
            filename: 'formula.md',
            content: '# Formula\n\nInline formula $q+1$.\n\n$$\nx^2\n$$\n\nFormula tail.',
          },
          { filename: 'other.md', content: '# Other note' },
        ],
      });
      const notePath = fixture.notePaths[0]!;
      const blockReplacement = '\\frac{a}{b} + \\sqrt{c}';
      const inlineReplacement = '\\alpha + \\beta';

      await openAbsoluteNote(page, notePath);
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="math-block"] .katex`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} span[data-type="math-inline"] .katex`)).toBeVisible();
      const blockTextarea = await openMathPopup(page, 'block');
      await expect(blockTextarea).toHaveValue('x^2');
      await blockTextarea.fill(blockReplacement);
      await page.keyboard.press('Control+Enter');
      await expect(page.locator('.math-editor-popup')).toHaveCount(0);
      await waitForEditorAnimationFrame(page);

      const inlineTextarea = await openMathPopup(page, 'inline');
      await expect(inlineTextarea).toHaveValue('q+1');
      await inlineTextarea.fill(inlineReplacement);
      await page.keyboard.press('Control+Enter');
      await expect(page.locator('.math-editor-popup')).toHaveCount(0);
      await waitForEditorAnimationFrame(page);

      await expect.poll(async () => page.evaluate(({ block, inline }) => {
        const content = String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '');
        return content.includes(block) && content.includes(inline);
      }, { block: blockReplacement, inline: inlineReplacement })).toBe(true);
      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      const saved = await page.evaluate((pathToRead) =>
        (window as any).__vlainaE2E.readTextFile(pathToRead), notePath);
      expect(saved).toContain(blockReplacement);
      expect(saved).toContain(inlineReplacement);
      expect(saved).not.toContain('x^2');
      expect(saved).not.toContain('q+1');

      await openAbsoluteNote(page, path.join(fixture.notesRootPath, 'other.md'));
      await openAbsoluteNote(page, notePath);
      await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="math-block"] .katex`)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} span[data-type="math-inline"] .katex`)).toBeVisible();
      await expect(await openMathPopup(page, 'block')).toHaveValue(blockReplacement);
      await page.keyboard.press('Escape');
      await expect(page.locator('.math-editor-popup')).toHaveCount(0);
      await expect(await openMathPopup(page, 'inline')).toHaveValue(inlineReplacement);
      await page.keyboard.press('Escape');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('persists cell edits and row and column deletion through table handle menus', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-table-delete-persistence');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'table-delete-persistence',
        files: [
          { filename: 'table.md', content: createTableMarkdown() },
          { filename: 'other.md', content: '# Other note' },
        ],
      });
      const notePath = fixture.notePaths[0]!;

      await openAbsoluteNote(page, notePath);
      await expect(page.locator(TABLE_BLOCK_SELECTOR)).toBeVisible({ timeout: 30_000 });
      await expectTableShape(page, 4, 4);

      const retainedCell = page.locator(`${TABLE_BLOCK_SELECTOR} td`, { hasText: 'Row three C' });
      const retainedCellBox = await retainedCell.boundingBox();
      expect(retainedCellBox).not.toBeNull();
      await page.mouse.click(
        retainedCellBox!.x + retainedCellBox!.width - 8,
        retainedCellBox!.y + retainedCellBox!.height / 2,
      );
      await page.keyboard.type(' edited');
      await expect(retainedCell).toContainText('Row three C edited');

      const columnMenu = await openTableHandleMenu(page, 'column', 1);
      await columnMenu.locator('[data-role="col-header-drag-menu-item"]').last().click();
      await expect(columnMenu).toHaveCount(0);
      await expectTableShape(page, 4, 3);

      const rowMenu = await openTableHandleMenu(page, 'row', 2);
      await rowMenu.locator('[data-role="row-header-drag-menu-item"]').last().click();
      await expect(rowMenu).toHaveCount(0);
      await expectTableShape(page, 3, 3);
      await expect(page.locator(TABLE_BLOCK_SELECTOR)).not.toContainText('Delete column sentinel');
      await expect(page.locator(TABLE_BLOCK_SELECTOR)).not.toContainText('Delete row sentinel');

      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      const saved = await page.evaluate((pathToRead) =>
        (window as any).__vlainaE2E.readTextFile(pathToRead), notePath);
      expect(saved).not.toContain('Delete column sentinel');
      expect(saved).not.toContain('Delete column row');
      expect(saved).not.toContain('Delete row sentinel');
      expect(saved).toContain('Row three C edited');
      expect(saved).toContain('Row three D');

      await openAbsoluteNote(page, path.join(fixture.notesRootPath, 'other.md'));
      await openAbsoluteNote(page, notePath);
      await expectTableShape(page, 3, 3);
      await expect(page.locator(TABLE_BLOCK_SELECTOR)).not.toContainText('Delete column');
      await expect(page.locator(TABLE_BLOCK_SELECTOR)).not.toContainText('Delete row sentinel');
      await expect(page.locator(TABLE_BLOCK_SELECTOR)).toContainText('Row three C edited');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
