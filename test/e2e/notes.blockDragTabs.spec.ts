import { expect, test, type Page } from '@playwright/test';
import {
  BLOCK_CONTROLS_SELECTOR,
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  createVaultFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openAbsoluteNote,
} from './notesE2E';
import { moveMouseToBlockHandleGutter } from './notesBlockSelectionShared';

const SOURCE_INITIAL = [
  '# Source',
  '',
  'Source keep before',
  '',
  'Move this block across tabs',
  '',
  'Source keep after',
].join('\n');

const TARGET_INITIAL = [
  '# Target',
  '',
  'Target keep before',
  '',
  'Target drop anchor',
].join('\n');

async function getTabBox(page: Page, notePath: string): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const box = await page.evaluate((pathToFind) => {
    const tab = Array.from(document.querySelectorAll<HTMLElement>('[data-notes-tab-path]'))
      .find((element) => element.dataset.notesTabPath === pathToFind);
    if (!tab) return null;
    const rect = tab.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }, notePath);

  if (!box) {
    throw new Error(`Could not resolve tab geometry for ${notePath}`);
  }
  return box;
}

async function getVisibleParagraphBox(page: Page, text: string): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const box = await page.locator(`${EDITOR_SELECTOR} p`, { hasText: text }).boundingBox();
  if (!box) {
    throw new Error(`Could not resolve paragraph geometry for ${text}`);
  }
  return box;
}

async function beginHandleDrag(page: Page): Promise<void> {
  const handleBox = await page.locator('.editor-block-control-handle').boundingBox();
  if (!handleBox) {
    throw new Error('Could not resolve block drag handle geometry');
  }

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 28, startY, { steps: 4 });
  await expect.poll(async () => page.evaluate(() =>
    document.body.classList.contains('editor-block-drag-active')
  ), { message: 'Expected block drag to become active' }).toBe(true);
}

async function selectSourceBlockAndShowHandle(page: Page): Promise<void> {
  const selectedCount = await page.evaluate(() =>
    (window as any).__vlainaE2E.selectNoteBlocksByText(['Move this block across tabs'])
  );
  expect(selectedCount).toBe(1);
  await moveMouseToBlockHandleGutter(
    page,
    page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Move this block across tabs' }),
  );
  await expect(page.locator(BLOCK_CONTROLS_SELECTOR)).toBeVisible();
}

test.describe('notes block drag across tabs', () => {
  test.setTimeout(90_000);

  test('opens a hovered note tab and moves the dragged block into that note', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-drag-tabs');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const fixture = await createVaultFilesFixture(page, {
        name: 'block-drag-tabs',
        files: [
          { filename: 'source-tab.md', content: SOURCE_INITIAL },
          { filename: 'target-tab.md', content: TARGET_INITIAL },
        ],
      });
      const [sourcePath, targetPath] = fixture.notePaths;
      if (!sourcePath || !targetPath) {
        throw new Error('Missing fixture note paths');
      }

      await openAbsoluteNote(page, sourcePath);
      await openAbsoluteNote(page, targetPath);
      await openAbsoluteNote(page, sourcePath);
      await expect.poll(async () => page.locator('[data-notes-tab-path]').count(), { timeout: 10_000 })
        .toBeGreaterThanOrEqual(2);
      await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Move this block across tabs' })).toBeVisible();

      await selectSourceBlockAndShowHandle(page);
      await beginHandleDrag(page);

      const targetTabBox = await getTabBox(page, targetPath);
      await page.mouse.move(
        targetTabBox.x + targetTabBox.width / 2,
        targetTabBox.y + targetTabBox.height / 2,
        { steps: 8 },
      );

      await expect.poll(async () => page.evaluate(() =>
        (window as any).__vlainaE2E.getNotesState().currentNote?.path ?? null
      ), { timeout: 10_000, message: 'Expected hovering the target tab to open it' }).toBe(targetPath);
      await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Target drop anchor' }))
        .toBeVisible({ timeout: 10_000 });

      const anchorBox = await getVisibleParagraphBox(page, 'Target drop anchor');
      await page.mouse.move(
        anchorBox.x + Math.min(40, Math.max(12, anchorBox.width / 3)),
        anchorBox.y + 2,
        { steps: 10 },
      );
      await page.mouse.up();

      await expect.poll(async () => page.evaluate(() =>
        document.body.classList.contains('editor-block-drag-active')
      ), { message: 'Expected block drag to settle' }).toBe(false);

      await expect.poll(async () => page.evaluate(() =>
        String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
      ), { timeout: 10_000 }).toContain('Move this block across tabs');
      await expect.poll(async () => page.evaluate(() =>
        (window as any).__vlainaE2E.getNoteSelectableBlocks()
          .map((block: { text: string }) => block.text.trim())
          .filter((text: string) => text.length > 0)
      ), { timeout: 10_000 }).toEqual([
        'Target',
        'Target keep before',
        'Move this block across tabs',
        'Target drop anchor',
      ]);
      await expect.poll(async () => page.evaluate((pathToRead) =>
        (window as any).__vlainaE2E.readTextFile(pathToRead), targetPath
      ), { timeout: 10_000, message: 'Expected target note to be saved after cross-tab block drop' })
        .toContain('Move this block across tabs');
      await expect.poll(async () => page.evaluate((pathToRead) =>
        (window as any).__vlainaE2E.readTextFile(pathToRead), sourcePath
      ), { timeout: 10_000, message: 'Expected source note deletion to be saved after cross-tab block drop' })
        .not.toContain('Move this block across tabs');

      await openAbsoluteNote(page, sourcePath);
      await expect.poll(async () => page.evaluate(() =>
        String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
      ), { timeout: 10_000 }).not.toContain('Move this block across tabs');
      await expect.poll(async () => page.evaluate(() =>
        String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
      ), { timeout: 10_000 }).toContain('Source keep before');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps the source block in place when the mouse is released outside the app window', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-drag-outside-window');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const fixture = await createVaultFilesFixture(page, {
        name: 'block-drag-outside-window',
        files: [
          { filename: 'source-outside.md', content: SOURCE_INITIAL },
        ],
      });
      const [sourcePath] = fixture.notePaths;
      if (!sourcePath) {
        throw new Error('Missing fixture source path');
      }

      await openAbsoluteNote(page, sourcePath);
      await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Move this block across tabs' })).toBeVisible();

      await selectSourceBlockAndShowHandle(page);
      await beginHandleDrag(page);
      await page.mouse.move(-50, -50, { steps: 8 });
      await page.mouse.up();

      await expect.poll(async () => page.evaluate(() =>
        document.body.classList.contains('editor-block-drag-active')
      ), { message: 'Expected outside-window block drag to settle' }).toBe(false);
      await expect.poll(async () => page.evaluate(() =>
        String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
      ), { timeout: 10_000 }).toBe(SOURCE_INITIAL);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
