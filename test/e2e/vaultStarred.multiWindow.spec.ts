import { expect, test, type Page } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

async function getVaultState(page: Page) {
  return page.evaluate(() => (window as any).__vlainaE2E.getVaultState());
}

async function getStarredState(page: Page) {
  return page.evaluate(() => (window as any).__vlainaE2E.getStarredState());
}

test.describe('multi-window vault and starred sync', () => {
  test.setTimeout(90_000);

  test('syncs recent vault changes, repairs vault config, and propagates starred edits', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('vault-starred-multi-window');

    try {
      await app.firstWindow();
      const [first] = await getOpenBridgePages(app, 1);
      await first.evaluate(() => (window as any).__vlainaE2E.createWindow({ viewMode: 'notes' }));
      let [main, second] = await getOpenBridgePages(app, 2);

      const { vaultPath, notePath } = await main.evaluate(() =>
        (window as any).__vlainaE2E.createVaultFixture({
          name: 'primary',
          filename: 'starred.md',
          content: '# Starred\n\nShared\n',
        })
      );

      await main.evaluate(
        ({ path: openedPath, name }) => (window as any).__vlainaE2E.openVault(openedPath, name),
        { path: vaultPath, name: 'Primary Vault' },
      );

      await expect.poll(async () => {
        const state = await getVaultState(second);
        return state.recentVaults.map((vault: { path: string; name: string }) => ({
          path: vault.path,
          name: vault.name,
        }));
      }).toContainEqual({ path: vaultPath, name: 'Primary Vault' });

      const config = await main.evaluate((pathToRead) => (window as any).__vlainaE2E.readVaultConfig(pathToRead), vaultPath);
      expect(config).toMatchObject({ version: 1, vaultPath });

      await second.evaluate(
        ({ path: openedPath, name }) => (window as any).__vlainaE2E.openVault(openedPath, name),
        { path: vaultPath, name: 'Primary Vault' },
      );
      await Promise.all([
        main.evaluate((pathToLoad) => (window as any).__vlainaE2E.loadStarred(pathToLoad), vaultPath),
        second.evaluate((pathToLoad) => (window as any).__vlainaE2E.loadStarred(pathToLoad), vaultPath),
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
        notesPath: vaultPath,
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

      const { vaultPath: secondaryVaultPath } = await main.evaluate(() =>
        (window as any).__vlainaE2E.createVaultFixture({
          name: 'secondary',
          filename: 'other.md',
          content: '# Other\n',
        })
      );
      await main.evaluate(
        ({ path: openedPath, name }) => (window as any).__vlainaE2E.openVault(openedPath, name),
        { path: secondaryVaultPath, name: 'Secondary Vault' },
      );

      await expect.poll(async () => {
        const state = await getVaultState(second);
        return state.recentVaults.map((vault: { path: string }) => vault.path);
      }).toEqual(expect.arrayContaining([vaultPath, secondaryVaultPath]));

      const primaryRecentId = await main.evaluate((pathToRemove) => {
        const state = (window as any).__vlainaE2E.getVaultState();
        return state.recentVaults.find((vault: { path: string }) => vault.path === pathToRemove)?.id ?? null;
      }, vaultPath);
      expect(primaryRecentId).toBeTruthy();

      await main.evaluate((id) => (window as any).__vlainaE2E.removeRecentVault(id), primaryRecentId);

      await expect.poll(async () => {
        const state = await getVaultState(second);
        return state.recentVaults.map((vault: { path: string }) => vault.path);
      }).not.toContain(vaultPath);

      [main, second] = await getOpenBridgePages(app, 2);
      expect(await getVaultState(main)).toMatchObject({ error: null });
      expect(await getVaultState(second)).toMatchObject({ error: null });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
