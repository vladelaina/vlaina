import { expect, test, type Page } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

async function getNotesRootState(page: Page) {
  return page.evaluate(() => (window as any).__vlainaE2E.getNotesRootState());
}

async function getStarredState(page: Page) {
  return page.evaluate(() => (window as any).__vlainaE2E.getStarredState());
}

test.describe('multi-window notes root and starred sync', () => {
  test.setTimeout(90_000);

  test('syncs recent notes root changes, repairs notes root config, and propagates starred edits', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-root-starred-multi-window');

    try {
      await app.firstWindow();
      const [first] = await getOpenBridgePages(app, 1);
      await first.evaluate(() => (window as any).__vlainaE2E.createWindow({ viewMode: 'notes' }));
      let [main, second] = await getOpenBridgePages(app, 2);

      const { notesRootPath, notePath } = await main.evaluate(() =>
        (window as any).__vlainaE2E.createNotesRootFixture({
          name: 'primary',
          filename: 'starred.md',
          content: '# Starred\n\nShared\n',
        })
      );

      await main.evaluate(
        ({ path: openedPath, name }) => (window as any).__vlainaE2E.openNotesRoot(openedPath, name),
        { path: notesRootPath, name: 'Primary Notes Root' },
      );

      await expect.poll(async () => {
        const state = await getNotesRootState(second);
        return state.recentNotesRoots.map((notesRoot: { path: string; name: string }) => ({
          path: notesRoot.path,
          name: notesRoot.name,
        }));
      }).toContainEqual({ path: notesRootPath, name: 'Primary Notes Root' });

      const config = await main.evaluate((pathToRead) => (window as any).__vlainaE2E.readNotesRootConfig(pathToRead), notesRootPath);
      expect(config).toMatchObject({ version: 1, notesRootPath });

      await second.evaluate(
        ({ path: openedPath, name }) => (window as any).__vlainaE2E.openNotesRoot(openedPath, name),
        { path: notesRootPath, name: 'Primary Notes Root' },
      );
      await Promise.all([
        main.evaluate((pathToLoad) => (window as any).__vlainaE2E.loadStarred(pathToLoad), notesRootPath),
        second.evaluate((pathToLoad) => (window as any).__vlainaE2E.loadStarred(pathToLoad), notesRootPath),
      ]);

      await main.evaluate((pathToStar) => (window as any).__vlainaE2E.toggleStarred(pathToStar), notePath);

      await expect.poll(async () => {
        const state = await getStarredState(second);
        return {
          notesPath: state.notesPath,
          starredNotes: state.starredNotes,
          loaded: state.starredLoaded,
        };
      }).toEqual({
        notesPath: notesRootPath,
        starredNotes: ['starred.md'],
        loaded: true,
      });

      const starredEntry = await second.evaluate(() => {
        const state = (window as any).__vlainaE2E.getStarredState();
        return state.starredEntries.find((entry: { relativePath: string }) => entry.relativePath === 'starred.md');
      });
      expect(starredEntry?.id).toBeTruthy();

      await second.evaluate((id) => (window as any).__vlainaE2E.removeStarredEntry(id), starredEntry.id);

      await expect.poll(async () => {
        const state = await getStarredState(main);
        return state.starredNotes;
      }).toEqual([]);

      const { notesRootPath: secondaryNotesRootPath } = await main.evaluate(() =>
        (window as any).__vlainaE2E.createNotesRootFixture({
          name: 'secondary',
          filename: 'other.md',
          content: '# Other\n',
        })
      );
      await main.evaluate(
        ({ path: openedPath, name }) => (window as any).__vlainaE2E.openNotesRoot(openedPath, name),
        { path: secondaryNotesRootPath, name: 'Secondary Notes Root' },
      );

      await expect.poll(async () => {
        const state = await getNotesRootState(second);
        return state.recentNotesRoots.map((notesRoot: { path: string }) => notesRoot.path);
      }).toEqual(expect.arrayContaining([notesRootPath, secondaryNotesRootPath]));

      const primaryRecentId = await main.evaluate((pathToRemove) => {
        const state = (window as any).__vlainaE2E.getNotesRootState();
        return state.recentNotesRoots.find((notesRoot: { path: string }) => notesRoot.path === pathToRemove)?.id ?? null;
      }, notesRootPath);
      expect(primaryRecentId).toBeTruthy();

      await main.evaluate((id) => (window as any).__vlainaE2E.removeRecentNotesRoot(id), primaryRecentId);

      await expect.poll(async () => {
        const state = await getNotesRootState(second);
        return state.recentNotesRoots.map((notesRoot: { path: string }) => notesRoot.path);
      }).not.toContain(notesRootPath);

      [main, second] = await getOpenBridgePages(app, 2);
      expect(await getNotesRootState(main)).toMatchObject({ error: null });
      expect(await getNotesRootState(second)).toMatchObject({ error: null });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
