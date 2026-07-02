import { expect, test } from '@playwright/test';
import path from 'node:path';
import {
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  cleanupIsolatedElectron,
  createNotesRootFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openNotesRootInNotes,
} from './notesE2E';

const TITLE_INPUT_SELECTOR = '[data-note-title-input="true"]';
const NEW_NOTE_BUTTON_SELECTOR = '.notes-tab-row-new-note-button';
const ACTIVE_TAB_SELECTOR = '[data-notes-tab-active="true"]';

test.describe('notes named draft creation', () => {
  test('keeps a named empty draft after it is materialized into a notesRoot file', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-named-draft');
    const title = 'Named draft from e2e';
    const fileName = `${title}.md`;

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'notes-named-draft',
        files: [
          {
            filename: 'alpha.md',
            content: '# Alpha\n\nExisting note.\n',
          },
        ],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Notes Named Draft NotesRoot',
        minFileCount: 1,
      });

      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'alpha' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Existing note', { timeout: 30_000 });

      const newNoteButton = page.locator(NEW_NOTE_BUTTON_SELECTOR);
      const newNoteButtonBox = await newNoteButton.boundingBox();
      expect(newNoteButtonBox).not.toBeNull();
      await page.mouse.move(
        newNoteButtonBox!.x + newNoteButtonBox!.width / 2,
        newNoteButtonBox!.y + newNoteButtonBox!.height / 2,
      );
      await expect(newNoteButton).toHaveCSS('pointer-events', 'auto');
      await newNoteButton.click();
      await expect.poll(async () => page.evaluate(() => {
        const state = (window as any).__vlainaE2E.getNotesState();
        return state.currentNote?.path?.startsWith('draft:') ?? false;
      }), { timeout: 10_000 }).toBe(true);

      const titleInput = page.locator(TITLE_INPUT_SELECTOR);
      await expect(titleInput).toBeVisible({ timeout: 10_000 });
      await titleInput.fill(title);
      await titleInput.press('Enter');

      await expect.poll(async () => page.evaluate((expectedTitle) => {
        const state = (window as any).__vlainaE2E.getNotesState();
        return {
          currentPath: state.currentNote?.path ?? null,
          currentContent: state.currentNote?.content ?? null,
          isDirty: state.isDirty,
          error: state.error,
          tabs: state.openTabs.map((tab: { path: string; name: string; isDirty?: boolean }) => ({
            path: tab.path,
            name: tab.name,
            isDirty: Boolean(tab.isDirty),
          })),
          titleValue: document.querySelector<HTMLTextAreaElement>('[data-note-title-input="true"]')?.value ?? null,
          sidebarText: document.querySelector('[data-notes-sidebar-scroll-root="true"]')?.textContent ?? '',
          expectedTitle,
        };
      }, title), { timeout: 20_000 }).toMatchObject({
        currentPath: fileName,
        currentContent: '',
        isDirty: false,
        error: null,
        titleValue: title,
        tabs: [{ path: fileName, name: title, isDirty: false }],
      });
      await expect(page.locator(FILE_TREE_FILE_SELECTOR, { hasText: title })).toHaveCount(1);
      await expect(page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'Untitled' })).toHaveCount(0);

      await page.locator(ACTIVE_TAB_SELECTOR).click({ button: 'middle' });
      await expect.poll(async () => page.evaluate(() => {
        const state = (window as any).__vlainaE2E.getNotesState();
        return {
          currentPath: state.currentNote?.path ?? null,
          openTabCount: state.openTabs.length,
          sidebarText: document.querySelector('[data-notes-sidebar-scroll-root="true"]')?.textContent ?? '',
        };
      }), { timeout: 10_000 }).toMatchObject({
        currentPath: null,
        openTabCount: 0,
      });

      await expect(page.locator(FILE_TREE_FILE_SELECTOR, { hasText: title })).toHaveCount(1);
      await expect.poll(async () => page.evaluate((absolutePath) =>
        (window as any).__vlainaE2E.readTextFile(absolutePath),
        path.join(fixture.notesRootPath, fileName),
      ), { timeout: 10_000 }).toBe('');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
