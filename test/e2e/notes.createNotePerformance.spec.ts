import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  cleanupIsolatedElectron,
  createVaultFilesFixture,
  launchIsolatedElectron,
  getOpenBridgePages,
  openVaultInNotes,
} from './notesE2E';

const SIDEBAR_MENU_LAYER_SELECTOR = '[data-sidebar-context-menu-layer="true"]';
const ROOT_FOLDER_ROW_SELECTOR = '[data-notes-root-folder-row="true"]';
const NEW_NOTE_MENU_ITEM_SELECTOR = `${SIDEBAR_MENU_LAYER_SELECTOR} [data-sidebar-context-menu-item="new-note"]`;
const CREATE_DRAFT_SWITCH_BUDGET_MS = 500;
const CREATE_DRAFT_SWITCH_POLL_INTERVALS_MS = [16, 32, 50, 100];

function createDirtyMarkdown(): string {
  const paragraph = [
    'Dirty current note content used to catch regressions where creating a new note saves the current note first.',
    'The new-note action should keep this tab dirty and switch to a fresh draft immediately.',
  ].join(' ');

  return [
    '# Dirty current note',
    '',
    ...Array.from({ length: 600 }, (_value, index) => `${index}. ${paragraph}`),
  ].join('\n');
}

test.describe('notes create note performance', () => {
  test('right-click new note opens an in-memory draft immediately', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-create-note-performance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const fixture = await createVaultFilesFixture(page, {
        name: 'notes-create-note-performance',
        files: [
          {
            filename: 'alpha-create-performance.md',
            content: '# Alpha\n\nInitial content.\n',
          },
        ],
      });

      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Notes Create Performance Vault',
        minFileCount: 1,
      });
      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'alpha-create-performance' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Initial content', { timeout: 30_000 });

      await page.evaluate((content) => (window as any).__vlainaE2E.updateCurrentNoteContent(content), createDirtyMarkdown());
      await expect.poll(async () => page.evaluate(() => {
        const state = (window as any).__vlainaE2E.getNotesState();
        return {
          currentPath: state.currentNote?.path ?? null,
          isDirty: state.isDirty,
          dirtyTabCount: state.openTabs.filter((tab: { isDirty?: boolean }) => tab.isDirty).length,
        };
      }), { timeout: 10_000 }).toMatchObject({
        currentPath: 'alpha-create-performance.md',
        isDirty: true,
        dirtyTabCount: 1,
      });

      await page.locator(ROOT_FOLDER_ROW_SELECTOR).first().click({ button: 'right' });
      await expect(page.locator(SIDEBAR_MENU_LAYER_SELECTOR)).toBeVisible({ timeout: 10_000 });

      const startedAt = Date.now();
      await page.locator(NEW_NOTE_MENU_ITEM_SELECTOR).click();
      await expect.poll(async () => page.evaluate(() => {
        const state = (window as any).__vlainaE2E.getNotesState();
        const currentPath = state.currentNote?.path ?? null;
        return {
          currentPath,
          isDraft: currentPath?.startsWith('draft:') ?? false,
          alphaTabDirty: state.openTabs.some((tab: { path: string; isDirty?: boolean }) =>
            tab.path === 'alpha-create-performance.md' && tab.isDirty === true
          ),
          draftTabOpen: state.openTabs.some((tab: { path: string }) => tab.path === currentPath),
        };
      }), {
        timeout: CREATE_DRAFT_SWITCH_BUDGET_MS,
        intervals: CREATE_DRAFT_SWITCH_POLL_INTERVALS_MS,
      }).toMatchObject({
        isDraft: true,
        alphaTabDirty: true,
        draftTabOpen: true,
      });
      const switchMs = Date.now() - startedAt;
      const draftPath = await page.evaluate(() => {
        const state = (window as any).__vlainaE2E.getNotesState();
        return state.currentNote?.path ?? null;
      });

      console.info('[notes-create-note-performance]', {
        switchMs,
        budgetMs: CREATE_DRAFT_SWITCH_BUDGET_MS,
        draftPath,
      });

      expect(switchMs).toBeLessThan(CREATE_DRAFT_SWITCH_BUDGET_MS);
      await expect(page.locator(SIDEBAR_MENU_LAYER_SELECTOR)).toHaveCount(0, { timeout: 10_000 });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
