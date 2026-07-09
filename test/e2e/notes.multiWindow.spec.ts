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

      await second.evaluate(() =>
        (window as any).__vlainaE2E.updateCurrentNoteContent('# Conflict\n\nLine: changed in second\n')
      );
      await expect.poll(async () => {
        const state = await getNotesState(second);
        return {
          dirty: state.isDirty,
          hasSecondEdit: String(state.currentNote?.content ?? '').includes('Line: changed in second'),
        };
      }).toEqual({
        dirty: true,
        hasSecondEdit: true,
      });

      await main.evaluate(() =>
        (window as any).__vlainaE2E.updateCurrentNoteContent('# Conflict\n\nLine: changed in main\n')
      );
      await main.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());

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

  test('keeps many windows stable while merging sequential non-overlapping stale saves', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-multi-window-stale-merge-many');

    try {
      await app.firstWindow();
      const [main] = await getOpenBridgePages(app, 1);
      const initialContent = [
        '# Many Windows',
        '',
        'A: initial',
        '',
        'B: initial',
        '',
        'C: initial',
        '',
        'D: initial',
        '',
      ].join('\n');
      const { notePath } = await main.evaluate((content) =>
        (window as any).__vlainaE2E.createNotesFixture({
          filename: 'many-windows.md',
          content,
        }), initialContent
      );

      for (let windowIndex = 1; windowIndex < 4; windowIndex += 1) {
        await main.evaluate(() => (window as any).__vlainaE2E.createWindow({ viewMode: 'notes' }));
      }
      const pages = await getOpenBridgePages(app, 4);
      await Promise.all(pages.map((page) =>
        page.evaluate((path) => (window as any).__vlainaE2E.openAbsoluteNote(path), notePath)
      ));

      const edits = [
        ['A: initial', 'A: changed in window one'],
        ['B: initial', 'B: changed in window two'],
        ['C: initial', 'C: changed in window three'],
        ['D: initial', 'D: changed in window four'],
      ] as const;

      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index]!;
        const [from, to] = edits[index]!;
        await page.evaluate(({ from, to }) => {
          const state = (window as any).__vlainaE2E.getNotesState();
          const content = String(state.currentNote?.content ?? '');
          (window as any).__vlainaE2E.updateCurrentNoteContent(content.replace(from, to));
        }, { from, to });
        await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());

        const savedState = await getNotesState(page);
        expect(savedState.isDirty).toBe(false);
        expect(savedState.error).toBeNull();
        const diskContent = await page.evaluate((path) => (window as any).__vlainaE2E.readTextFile(path), notePath);
        for (let savedIndex = 0; savedIndex <= index; savedIndex += 1) {
          expect(diskContent).toContain(edits[savedIndex]![1]);
        }
      }

      await Promise.all(pages.map((page) =>
        page.evaluate(() => (window as any).__vlainaE2E.syncCurrentNoteFromDisk({ force: true }))
      ));
      const finalStates = await Promise.all(pages.map(getNotesState));
      const diskContent = await main.evaluate((path) => (window as any).__vlainaE2E.readTextFile(path), notePath);

      for (const [, expectedText] of edits) {
        expect(diskContent).toContain(expectedText);
      }
      for (const state of finalStates) {
        expect(state.currentNote?.path).toBe(notePath);
        expect(state.isDirty).toBe(false);
        expect(state.error).toBeNull();
        for (const [, expectedText] of edits) {
          expect(state.currentNote?.content).toContain(expectedText);
        }
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
