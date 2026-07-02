import { expect, test, type Page } from '@playwright/test';
import {
  FILE_TREE_FILE_SELECTOR,
  cleanupIsolatedElectron,
  createNotesRootFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openNotesRootInNotes,
} from './notesE2E';

const FILE_TREE_PATH_SELECTOR = (path: string) => `[data-file-tree-path="${path}"]`;
const FILE_TREE_FOLDER_SELECTOR = (path: string) => `[data-file-tree-kind="folder"][data-file-tree-path="${path}"]`;

async function dragTreeItemToTarget(page: Page, sourceSelector: string, targetSelector: string) {
  const result = await page.evaluate(({ sourceSelector, targetSelector }) => {
    const sourceWrapper = document.querySelector<HTMLElement>(sourceSelector);
    const sourceRow = sourceWrapper?.firstElementChild instanceof HTMLElement
      ? sourceWrapper.firstElementChild
      : sourceWrapper;
    const target = document.querySelector<HTMLElement>(targetSelector);
    if (!sourceWrapper || !sourceRow || !target) {
      return {
        ok: false,
        reason: 'missing-element',
        hasSource: Boolean(sourceWrapper),
        hasSourceRow: Boolean(sourceRow),
        hasTarget: Boolean(target),
      };
    }

    const sourceBox = sourceRow.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    const start = {
      x: sourceBox.left + Math.min(sourceBox.width / 2, 120),
      y: sourceBox.top + sourceBox.height / 2,
    };
    const end = {
      x: targetBox.left + Math.min(targetBox.width / 2, 120),
      y: targetBox.top + targetBox.height / 2,
    };
    const dispatchPointer = (
      targetElement: EventTarget,
      type: string,
      point: { x: number; y: number },
      buttons: number,
    ) => {
      targetElement.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons,
        clientX: point.x,
        clientY: point.y,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      }));
    };

    dispatchPointer(sourceRow, 'pointerdown', start, 1);
    dispatchPointer(document, 'pointermove', { x: start.x + 32, y: start.y + 18 }, 1);
    dispatchPointer(document, 'pointermove', end, 1);
    const hitTargets = document.elementsFromPoint(end.x, end.y).map((element) => {
      const htmlElement = element instanceof HTMLElement ? element : null;
      return {
        tagName: htmlElement?.tagName ?? element.tagName,
        path: htmlElement?.dataset.fileTreePath ?? null,
        kind: htmlElement?.dataset.fileTreeKind ?? null,
        root: htmlElement?.dataset.fileTreeRootDropTarget ?? null,
      };
    });
    dispatchPointer(document, 'pointerup', end, 0);

    return {
      ok: true,
      hitTargets,
    };
  }, { sourceSelector, targetSelector });

  expect(result).toMatchObject({ ok: true });
}

async function expectPathVisible(page: Page, path: string) {
  await expect(page.locator(FILE_TREE_PATH_SELECTOR(path)).first()).toBeVisible({ timeout: 10_000 });
}

async function expectPathGone(page: Page, path: string) {
  await expect(page.locator(FILE_TREE_PATH_SELECTOR(path))).toHaveCount(0, { timeout: 10_000 });
}

async function ensureFolderExpanded(page: Page, folderPath: string, childPath: string) {
  const child = page.locator(FILE_TREE_PATH_SELECTOR(childPath)).first();
  if (await child.isVisible().catch(() => false)) {
    return;
  }

  await page.locator(FILE_TREE_FOLDER_SELECTOR(folderPath)).first().click();
  await expect(child).toBeVisible({ timeout: 10_000 });
}

test.describe('notes sidebar drag and drop', () => {
  test('moves file tree items between nested folders and the root drop target', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-sidebar-drag-drop-root');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const fixture = await createNotesRootFilesFixture(page, {
        name: 'notes-sidebar-drag-drop-root',
        files: [
          { filename: 'root-anchor.md', content: '# Root Anchor\n' },
          { filename: 'docs/nested-to-root.md', content: '# Nested To Root\n' },
          { filename: 'docs/sub/deep.md', content: '# Deep\n' },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Sidebar Drag Drop NotesRoot',
        minFileCount: 1,
      });

      await ensureFolderExpanded(page, 'docs', 'docs/nested-to-root.md');

      await dragTreeItemToTarget(
        page,
        `${FILE_TREE_FILE_SELECTOR}${FILE_TREE_PATH_SELECTOR('docs/nested-to-root.md')}`,
        `${FILE_TREE_FILE_SELECTOR}${FILE_TREE_PATH_SELECTOR('root-anchor.md')}`,
      );
      await expectPathVisible(page, 'nested-to-root.md');
      await expectPathGone(page, 'docs/nested-to-root.md');

      await dragTreeItemToTarget(
        page,
        `${FILE_TREE_FILE_SELECTOR}${FILE_TREE_PATH_SELECTOR('root-anchor.md')}`,
        FILE_TREE_FOLDER_SELECTOR('docs'),
      );
      await expectPathVisible(page, 'docs/root-anchor.md');
      await expectPathGone(page, 'root-anchor.md');

      await dragTreeItemToTarget(
        page,
        `${FILE_TREE_FILE_SELECTOR}${FILE_TREE_PATH_SELECTOR('docs/root-anchor.md')}`,
        `${FILE_TREE_FILE_SELECTOR}${FILE_TREE_PATH_SELECTOR('nested-to-root.md')}`,
      );
      await expectPathVisible(page, 'root-anchor.md');
      await expectPathGone(page, 'docs/root-anchor.md');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
