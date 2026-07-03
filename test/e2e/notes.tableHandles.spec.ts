import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

const TABLE_BLOCK_SELECTOR = '.milkdown .milkdown-table-block';
const COLUMN_CONTROL_SELECTOR = '[data-role="col-header-drag-control"]';
const ROW_CONTROL_SELECTOR = '[data-role="row-header-drag-control"]';
const COLUMN_HIGHLIGHT_SELECTOR = '[data-role="col-header-drag-source-highlight"]';
const ROW_HIGHLIGHT_SELECTOR = '[data-role="row-header-drag-source-highlight"]';
const COLUMN_MENU_SELECTOR = '[data-role="col-header-drag-menu"]';
const ROW_MENU_SELECTOR = '[data-role="row-header-drag-menu"]';

function createTableMarkdown() {
  return [
    '# Table Handles E2E',
    '',
    '| First | Second | Third |',
    '| --- | --- | --- |',
    '| Alpha row | Beta row | Gamma row |',
    '| Delta row | Epsilon row | Zeta row |',
    '',
    'After table sentinel.',
  ].join('\n');
}

function collectPageErrors(page: Page) {
  const errors: string[] = [];

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  return errors;
}

async function getTablePoint(
  page: Page,
  target: 'column-hover' | 'row-hover',
) {
  return page.evaluate(({ tableBlockSelector, target }) => {
    const tableBlock = document.querySelector<HTMLElement>(tableBlockSelector);
    const table = tableBlock?.querySelector<HTMLElement>('table');
    if (!table) return null;

    const firstHeaderCell = table.querySelector<HTMLElement>('th, td');
    const secondBodyRow = table.querySelectorAll<HTMLTableRowElement>('tr')[1];
    const firstBodyCell = secondBodyRow?.querySelector<HTMLElement>('th, td');
    const cell = target === 'column-hover' ? firstHeaderCell : firstBodyCell;
    if (!cell) return null;

    cell.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = cell.getBoundingClientRect();
    return target === 'column-hover'
      ? { x: rect.left + rect.width / 2, y: rect.top + 2 }
      : { x: rect.left - 4, y: rect.top + rect.height / 2 };
  }, { tableBlockSelector: TABLE_BLOCK_SELECTOR, target });
}

async function revealHandle(
  page: Page,
  target: 'column' | 'row',
) {
  const point = await getTablePoint(
    page,
    target === 'column' ? 'column-hover' : 'row-hover',
  );
  expect(point, `Expected ${target} table handle hover point`).not.toBeNull();

  await page.mouse.move(point!.x, point!.y);
  const control = page.locator(target === 'column' ? COLUMN_CONTROL_SELECTOR : ROW_CONTROL_SELECTOR).first();
  await expect(control).toBeVisible({ timeout: 5_000 });
  const box = await control.boundingBox();
  expect(box, `Expected ${target} table handle box`).not.toBeNull();
  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  };
}

async function getHighlightVisual(page: Page, selector: string) {
  return page.evaluate((highlightSelector) => {
    const highlight = document.querySelector<HTMLElement>(highlightSelector);
    if (!highlight) return null;
    const rect = highlight.getBoundingClientRect();
    const style = window.getComputedStyle(highlight);
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
    };
  }, selector);
}

async function expectHighlighted(page: Page, selector: string) {
  await expect(page.locator(selector)).toHaveCount(1);
  const visual = await getHighlightVisual(page, selector);
  expect(visual).not.toBeNull();
  expect(visual!.width).toBeGreaterThan(0);
  expect(visual!.height).toBeGreaterThan(0);
  expect(visual!.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(visual!.boxShadow).toContain('inset');
  expect(visual!.boxShadow).not.toBe('none');
}

async function expectNoSelectedCells(page: Page) {
  await expect.poll(async () =>
    page.locator(`${TABLE_BLOCK_SELECTOR} .selectedCell`).count()
  ).toBe(0);
}

async function expectTableShape(page: Page, rows: number, columns: number) {
  await expect.poll(async () => page.evaluate((tableBlockSelector) => {
    const table = document.querySelector(`${tableBlockSelector} table`);
    const firstRow = table?.querySelector('tr');
    return {
      rows: table?.querySelectorAll('tr').length ?? 0,
      columns: firstRow?.querySelectorAll('th, td').length ?? 0,
    };
  }, TABLE_BLOCK_SELECTOR)).toEqual({ rows, columns });
}

function getMarkdownTableShape(markdown: string) {
  const tableLines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.includes('|'));
  const rows = tableLines
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) =>
      cells.length > 0 && !cells.every((cell) => /^:?-{3,}:?$/.test(cell))
    );

  return {
    rows: rows.length,
    columns: rows[0]?.length ?? 0,
  };
}

async function expectPersistedTableShape(
  page: Page,
  notePath: string,
  rows: number,
  columns: number,
) {
  await expect.poll(async () => {
    const markdown = await page.evaluate((pathToRead) =>
      (window as any).__vlainaE2E.readTextFile(pathToRead), notePath);
    return getMarkdownTableShape(markdown);
  }, { timeout: 15_000 }).toEqual({ rows, columns });
}

type EditorSelectionSnapshot = {
  from: number;
  to: number;
  empty: boolean;
  selectedText: string;
  docTextLength: number;
};

async function moveEditorSelectionToDocumentEnd(page: Page): Promise<EditorSelectionSnapshot> {
  const selection = await page.evaluate(async () => {
    const summary = (window as any).__vlainaE2E.getEditorSelectionSummary();
    if (!summary) return null;
    return (window as any).__vlainaE2E.setEditorSelectionRange(Math.max(1, summary.docTextLength - 1));
  });
  expect(selection).not.toBeNull();
  return selection;
}

async function expectEditorSelectionUnchanged(
  page: Page,
  expected: EditorSelectionSnapshot,
) {
  await expect.poll(async () => page.evaluate(() =>
    (window as any).__vlainaE2E.getEditorSelectionSummary()
  )).toMatchObject({
    from: expected.from,
    to: expected.to,
    empty: expected.empty,
    selectedText: expected.selectedText,
    docTextLength: expected.docTextLength,
  });
}

async function expectTableControlOwnsFocus(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const active = document.activeElement;
    const activeElement = active instanceof HTMLElement ? active : null;
    return {
      activeIsEditor: Boolean(activeElement?.matches('.ProseMirror')),
      activeRole: activeElement?.dataset.role ?? null,
      insideTableControl: Boolean(activeElement?.closest([
        '[data-role="col-header-drag-control"]',
        '[data-role="row-header-drag-control"]',
        '[data-role="col-header-drag-menu"]',
        '[data-role="row-header-drag-menu"]',
      ].join(','))),
    };
  })).toMatchObject({
    activeIsEditor: false,
    insideTableControl: true,
  });
}

test.describe('notes table handles', () => {
  test('keeps row and column highlights continuous while opening handle menus', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-table-handles');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const errors = collectPageErrors(page);
      await page.setViewportSize({ width: 1280, height: 860 });

      const opened = await openMarkdownFixture(page, {
        filename: 'table-handles.md',
        content: createTableMarkdown(),
      });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Alpha row', { timeout: 30_000 });
      await expect(page.locator(TABLE_BLOCK_SELECTOR)).toBeVisible({ timeout: 30_000 });
      await waitForEditorAnimationFrame(page);
      const initialSelection = await moveEditorSelectionToDocumentEnd(page);

      const columnHandlePoint = await revealHandle(page, 'column');
      await page.mouse.move(columnHandlePoint.x, columnHandlePoint.y);
      await page.mouse.down();
      await expectHighlighted(page, COLUMN_HIGHLIGHT_SELECTOR);
      await page.mouse.up();
      await expect(page.locator(COLUMN_MENU_SELECTOR)).toBeVisible({ timeout: 5_000 });
      await expectHighlighted(page, COLUMN_HIGHLIGHT_SELECTOR);
      await expectTableControlOwnsFocus(page);
      await expectEditorSelectionUnchanged(page, initialSelection);

      await page.locator(`${COLUMN_MENU_SELECTOR} [data-role="col-header-drag-menu-item"]`).nth(1).click();
      await expect(page.locator(COLUMN_MENU_SELECTOR)).toHaveCount(0);
      await expect(page.locator(COLUMN_HIGHLIGHT_SELECTOR)).toHaveCount(0);
      await expectTableShape(page, 3, 4);
      await expectNoSelectedCells(page);

      const rowHandlePoint = await revealHandle(page, 'row');
      await page.mouse.move(rowHandlePoint.x, rowHandlePoint.y);
      await page.mouse.down();
      await expectHighlighted(page, ROW_HIGHLIGHT_SELECTOR);
      await page.mouse.up();
      await expect(page.locator(ROW_MENU_SELECTOR)).toBeVisible({ timeout: 5_000 });
      await expectHighlighted(page, ROW_HIGHLIGHT_SELECTOR);
      await expectTableControlOwnsFocus(page);

      await page.locator(`${ROW_MENU_SELECTOR} [data-role="row-header-drag-menu-item"]`).nth(1).click();
      await expect(page.locator(ROW_MENU_SELECTOR)).toHaveCount(0);
      await expect(page.locator(ROW_HIGHLIGHT_SELECTOR)).toHaveCount(0);
      await expectTableShape(page, 4, 4);
      await expectNoSelectedCells(page);
      await expectPersistedTableShape(page, opened.notePath, 4, 4);

      await openMarkdownFixture(page, {
        filename: 'other-table-note.md',
        content: '# Other table note',
      });
      await page.evaluate((pathToOpen) =>
        (window as any).__vlainaE2E.openAbsoluteNote(pathToOpen), opened.notePath);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Alpha row', { timeout: 30_000 });
      await expectTableShape(page, 4, 4);

      expect(errors).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
