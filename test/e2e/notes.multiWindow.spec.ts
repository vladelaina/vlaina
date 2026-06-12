import { expect, test, type Page } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

async function getNotesState(page: Page) {
  return page.evaluate(() => (window as any).__vlainaE2E.getNotesState());
}

test.describe('multi-window note document sync', () => {
  test.setTimeout(90_000);

  test('reloads clean notes and merges non-conflicting stale edits without blocking save', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-multi-window-clean-merge');

    try {
      await app.firstWindow();
      let [main] = await getOpenBridgePages(app, 1);
      const { notePath } = await main.evaluate(() =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'shared.md',
          content: '# Shared\n\nA: initial\n\nB: initial\n',
        })
      );

      await main.evaluate((path) => (window as any).__vlainaE2E.openAbsoluteNote(path), notePath);
      await main.evaluate(() => (window as any).__vlainaE2E.createWindow({ viewMode: 'notes' }));
      const pages = await getOpenBridgePages(app, 2);
      const second = pages.find((page) => page !== main) ?? pages[1];
      await second.evaluate((path) => (window as any).__vlainaE2E.openAbsoluteNote(path), notePath);

      await main.evaluate(() =>
        (window as any).__vlainaE2E.updateCurrentNoteContent('# Shared\n\nA: changed in main\n\nB: initial\n')
      );
      await main.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());

      await expect.poll(async () => {
        const result = await second.evaluate(() => (window as any).__vlainaE2E.syncCurrentNoteFromDisk({ force: true }));
        const state = await getNotesState(second);
        const content = String(state.currentNote?.content ?? '');
        return {
          synced: result === 'reloaded' || result === 'unchanged',
          hasMainEdit: content.includes('A: changed in main'),
          dirty: state.isDirty,
          error: state.error,
        };
      }).toEqual({
        synced: true,
        hasMainEdit: true,
        dirty: false,
        error: null,
      });

      await second.evaluate(() => {
        const state = (window as any).__vlainaE2E.getNotesState();
        const content = String(state.currentNote?.content ?? '');
        (window as any).__vlainaE2E.updateCurrentNoteContent(
          content.replace('B: initial', 'B: changed in second')
        );
      });
      await second.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());

      const diskContent = await second.evaluate((path) => (window as any).__vlainaE2E.readTextFile(path), notePath);
      expect(diskContent).toContain('A: changed in main');
      expect(diskContent).toContain('B: changed in second');

      await main.evaluate(() => (window as any).__vlainaE2E.syncCurrentNoteFromDisk({ force: true }));
      const mainState = await getNotesState(main);
      expect(mainState.currentNote?.content).toContain('A: changed in main');
      expect(mainState.currentNote?.content).toContain('B: changed in second');
      expect(mainState.isDirty).toBe(false);
      expect(mainState.error).toBeNull();
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('preserves dirty content and reports a conflict for overlapping stale edits', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-multi-window-conflict');

    try {
      await app.firstWindow();
      const [main] = await getOpenBridgePages(app, 1);
      const { notePath } = await main.evaluate(() =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'conflict.md',
          content: '# Conflict\n\nLine: initial\n',
        })
      );
      await main.evaluate((path) => (window as any).__vlainaE2E.openAbsoluteNote(path), notePath);
      await main.evaluate(() => (window as any).__vlainaE2E.createWindow({ viewMode: 'notes' }));
      const pages = await getOpenBridgePages(app, 2);
      const second = pages.find((page) => page !== main) ?? pages[1];
      await second.evaluate((path) => (window as any).__vlainaE2E.openAbsoluteNote(path), notePath);

      await main.evaluate(() =>
        (window as any).__vlainaE2E.updateCurrentNoteContent('# Conflict\n\nLine: changed in main\n')
      );
      await main.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());

      await second.evaluate(() =>
        (window as any).__vlainaE2E.updateCurrentNoteContent('# Conflict\n\nLine: changed in second\n')
      );
      await second.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());

      const secondState = await getNotesState(second);
      const diskContent = await second.evaluate((path) => (window as any).__vlainaE2E.readTextFile(path), notePath);
      expect(secondState.isDirty).toBe(true);
      expect(secondState.currentNote?.content).toContain('Line: changed in second');
      expect(secondState.error).toContain('Current note changed on disk');
      expect(diskContent).toContain('Line: changed in main');
      expect(diskContent).not.toContain('Line: changed in second');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
