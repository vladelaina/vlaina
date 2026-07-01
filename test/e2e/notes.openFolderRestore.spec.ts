import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  closeElectron,
  cleanupIsolatedElectron,
  createVaultFilesFixture,
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  getOpenBridgePages,
  launchIsolatedElectron,
  NOTE_SCROLL_ROOT_SELECTOR,
  openVaultInNotes,
  setAppViewMode,
} from './notesE2E';

function getVaultStorageKey(vaultPath: string): string {
  const normalized = vaultPath.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/+$/, '') || vaultPath;
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `vault-${(hash >>> 0).toString(36)}`;
}

async function writeVaultWorkspace(
  userDataDir: string,
  vaultPath: string,
  currentNotePath: string,
): Promise<void> {
  const workspaceDir = path.join(userDataDir, '.vlaina', 'notes', 'vaults', getVaultStorageKey(vaultPath));
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(
    path.join(workspaceDir, 'workspace.json'),
    JSON.stringify({
      currentNotePath,
      expandedFolders: [],
      fileTreeSortMode: 'name-asc',
    }, null, 2),
    'utf8',
  );
}

function createLongRestoreMarkdown(): string {
  return [
    '# Startup Restore Scroll',
    '',
    ...Array.from({ length: 90 }, (_, index) => (
      `Restore paragraph ${index + 1}: enough content to make the saved scroll position meaningful after relaunch.`
    )),
    '',
    'Restored workspace scroll sentinel.',
  ].join('\n\n');
}

test.describe('notes open folder restore', () => {
  test('does not keep the startup blank draft when opening a populated vault without a saved workspace note', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-open-folder-populated-no-restore');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await expect.poll(async () => page.evaluate(() => {
        const state = (window as any).__vlainaE2E.getNotesState();
        return {
          currentNotePath: state.currentNote?.path ?? null,
          openTabPaths: state.openTabs.map((tab: { path: string }) => tab.path),
        };
      }), { timeout: 30_000 }).toMatchObject({
        currentNotePath: expect.stringMatching(/^draft:/),
        openTabPaths: [expect.stringMatching(/^draft:/)],
      });

      const fixture = await createVaultFilesFixture(page, {
        name: 'populated-no-restore',
        files: [
          {
            filename: 'alpha.md',
            content: '# Alpha\n\nExisting note sentinel.\n',
          },
        ],
      });

      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Populated No Restore',
        minFileCount: 1,
      });

      await expect.poll(async () => page.evaluate(() => {
        const notesState = (window as any).__vlainaE2E.getNotesState();
        const vaultState = (window as any).__vlainaE2E.getVaultState();
        return {
          currentVaultPath: vaultState.currentVault?.path ?? null,
          currentNotePath: notesState.currentNote?.path ?? null,
          openTabPaths: notesState.openTabs.map((tab: { path: string }) => tab.path),
          fileRows: document.querySelectorAll('[data-file-tree-kind="file"]').length,
        };
      }), { timeout: 30_000 }).toMatchObject({
        currentVaultPath: fixture.vaultPath,
        currentNotePath: null,
        openTabPaths: [],
        fileRows: 1,
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('restores the saved current note when reopening a populated vault', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-open-folder-restore-last-note');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const firstVault = await createVaultFilesFixture(page, {
        name: 'restore-last-note-a',
        files: [
          {
            filename: 'alpha.md',
            content: '# Alpha\n\nLast opened alpha sentinel.\n',
          },
        ],
      });
      const secondVault = await createVaultFilesFixture(page, {
        name: 'restore-last-note-b',
        files: [
          {
            filename: 'beta.md',
            content: '# Beta\n\nSecond vault sentinel.\n',
          },
        ],
      });

      await openVaultInNotes(page, {
        vaultPath: firstVault.vaultPath,
        name: 'Restore Last Note A',
        minFileCount: 1,
      });
      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'alpha' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Last opened alpha sentinel', {
        timeout: 30_000,
      });

      await openVaultInNotes(page, {
        vaultPath: secondVault.vaultPath,
        name: 'Restore Last Note B',
        minFileCount: 1,
      });
      await expect.poll(async () => page.evaluate(() => {
        const notesState = (window as any).__vlainaE2E.getNotesState();
        const vaultState = (window as any).__vlainaE2E.getVaultState();
        return {
          currentVaultPath: vaultState.currentVault?.path ?? null,
          currentNotePath: notesState.currentNote?.path ?? null,
          openTabPaths: notesState.openTabs.map((tab: { path: string }) => tab.path),
        };
      }), { timeout: 30_000 }).toMatchObject({
        currentVaultPath: secondVault.vaultPath,
        currentNotePath: null,
        openTabPaths: [],
      });

      await openVaultInNotes(page, {
        vaultPath: firstVault.vaultPath,
        name: 'Restore Last Note A',
        minFileCount: 1,
      });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Last opened alpha sentinel', {
        timeout: 30_000,
      });
      await expect.poll(async () => page.evaluate(() => {
        const notesState = (window as any).__vlainaE2E.getNotesState();
        const vaultState = (window as any).__vlainaE2E.getVaultState();
        return {
          currentVaultPath: vaultState.currentVault?.path ?? null,
          currentNotePath: notesState.currentNote?.path ?? null,
          openTabPaths: notesState.openTabs.map((tab: { path: string }) => tab.path),
        };
      }), { timeout: 30_000 }).toMatchObject({
        currentVaultPath: firstVault.vaultPath,
        currentNotePath: 'alpha.md',
        openTabPaths: ['alpha.md'],
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('does not focus the workspace-restored note at the first line on app relaunch', async () => {
    const first = await launchIsolatedElectron('notes-open-folder-restore-scroll-a');
    let second: Awaited<ReturnType<typeof launchIsolatedElectron>> | null = null;
    const notePath = 'startup-restore-scroll.md';

    try {
      await first.app.firstWindow();
      const [page] = await getOpenBridgePages(first.app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const fixture = await createVaultFilesFixture(page, {
        name: 'restore-scroll-focus',
        files: [
          {
            filename: notePath,
            content: createLongRestoreMarkdown(),
          },
        ],
      });

      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Restore Scroll Focus',
        minFileCount: 1,
      });
      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'startup-restore-scroll' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Restored workspace scroll sentinel', {
        timeout: 30_000,
      });

      const savedScroll = await page.evaluate(({ scrollSelector, storageKey, vaultPath, notePath }) => {
        const scrollRoot = document.querySelector<HTMLElement>(scrollSelector);
        if (!scrollRoot) {
          throw new Error('Missing note scroll root');
        }

        const maxScrollTop = scrollRoot.scrollHeight - scrollRoot.clientHeight;
        const scrollTop = Math.min(maxScrollTop, Math.max(480, Math.round(maxScrollTop * 0.55)));
        scrollRoot.scrollTop = scrollTop;
        scrollRoot.dispatchEvent(new Event('scroll', { bubbles: true }));

        const identity = JSON.stringify([vaultPath, notePath]);
        const positions = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
        positions[identity] = { scrollTop, updatedAt: Date.now() };
        window.localStorage.setItem(storageKey, JSON.stringify(positions));

        return { maxScrollTop, scrollTop };
      }, {
        notePath,
        scrollSelector: NOTE_SCROLL_ROOT_SELECTOR,
        storageKey: 'vlaina-note-scroll-positions',
        vaultPath: fixture.vaultPath,
      });
      expect(savedScroll.maxScrollTop).toBeGreaterThan(700);
      expect(savedScroll.scrollTop).toBeGreaterThan(400);

      await writeVaultWorkspace(first.userDataDir, fixture.vaultPath, notePath);
      await closeElectron(first.app);

      second = await launchIsolatedElectron('notes-open-folder-restore-scroll-b', {
        envOverrides: {
          VLAINA_USER_DATA_DIR: first.userDataDir,
        },
      });
      await second.app.firstWindow();
      const [restoredPage] = await getOpenBridgePages(second.app, 1);
      await restoredPage.setViewportSize({ width: 1280, height: 860 });
      await setAppViewMode(restoredPage, 'notes');

      await expect(restoredPage.locator(EDITOR_SELECTOR)).toContainText('Restored workspace scroll sentinel', {
        timeout: 30_000,
      });
      await restoredPage.waitForTimeout(350);

      const restoredState = await restoredPage.evaluate((scrollSelector) => {
        const scrollRoot = document.querySelector<HTMLElement>(scrollSelector);
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        const activeElement = document.activeElement;
        const notesState = (window as any).__vlainaE2E.getNotesState();
        const vaultState = (window as any).__vlainaE2E.getVaultState();
        return {
          currentVaultPath: vaultState.currentVault?.path ?? null,
          currentNotePath: notesState.currentNote?.path ?? null,
          editorContainsFocus: Boolean(
            editor && activeElement instanceof Node && editor.contains(activeElement)
          ),
          scrollTop: Math.round(scrollRoot?.scrollTop ?? 0),
        };
      }, NOTE_SCROLL_ROOT_SELECTOR);

      expect(restoredState).toMatchObject({
        currentVaultPath: fixture.vaultPath,
        currentNotePath: notePath,
        editorContainsFocus: false,
      });
      expect(Math.abs(restoredState.scrollTop - savedScroll.scrollTop)).toBeLessThanOrEqual(180);
      expect(restoredState.scrollTop).toBeGreaterThan(300);
    } finally {
      if (second) {
        await cleanupIsolatedElectron(second.app, second.userDataRoot);
      }
      await cleanupIsolatedElectron(first.app, first.userDataRoot);
    }
  });
});
