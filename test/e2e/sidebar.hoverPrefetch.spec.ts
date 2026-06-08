import { expect, test } from '@playwright/test';
import {
  CHAT_SESSION_ROW_SELECTOR,
  CHAT_VIEW_SELECTOR,
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  cleanupIsolatedElectron,
  createChatFixture,
  createVaultFilesFixture,
  getChatSessionMessageStatus,
  getNoteContentCacheEntry,
  getOpenBridgePages,
  launchIsolatedElectron,
  openVaultInNotes,
  pruneNoteContentsCacheToOpenNotes,
  setAppViewMode,
  waitForChatSession,
} from './notesE2E';

function createPrefetchMarkdown(label: string): string {
  return [
    `# ${label} Prefetch Note`,
    '',
    `${label.toUpperCase()}_PREFETCH_SENTINEL first paragraph for hover prefetch.`,
    '',
    `${label} second paragraph keeps the note large enough to exercise a real markdown load.`,
    '',
    '- Prefetch bullet alpha',
    '- Prefetch bullet beta',
    '',
    `Final ${label} prefetch sentinel.`,
    '',
  ].join('\n');
}

test.describe('sidebar hover prefetch', () => {
  test.setTimeout(120_000);

  test('prefetches Notes file content on hover without switching the active note', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-hover-prefetch');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const fixture = await createVaultFilesFixture(page, {
        name: 'notes-hover-prefetch',
        files: [
          { filename: 'active-prefetch.md', content: createPrefetchMarkdown('active') },
          { filename: 'target-prefetch.md', content: createPrefetchMarkdown('target') },
        ],
      });
      const activePath = 'active-prefetch.md';
      const targetPath = 'target-prefetch.md';

      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Notes Hover Prefetch Vault',
        minFileCount: 2,
      });

      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'active-prefetch' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('ACTIVE_PREFETCH_SENTINEL', {
        timeout: 30_000,
      });

      await pruneNoteContentsCacheToOpenNotes(page);
      expect(await getNoteContentCacheEntry(page, targetPath)).toMatchObject({
        hasEntry: false,
        currentNotePath: activePath,
      });

      const targetRow = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'target-prefetch' }).first();
      await expect(targetRow).toBeVisible();
      const targetRowPoint = await targetRow.evaluate((element) => {
        const row = element.firstElementChild instanceof HTMLElement
          ? element.firstElementChild
          : element;
        const rect = row.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      });
      await page.mouse.move(targetRowPoint.x, targetRowPoint.y);
      await page.waitForTimeout(400);

      await expect.poll(() => getNoteContentCacheEntry(page, targetPath), { timeout: 10_000 }).toMatchObject({
        hasEntry: true,
        currentNotePath: activePath,
        contentPreview: expect.stringContaining('TARGET_PREFETCH_SENTINEL'),
      });

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('ACTIVE_PREFETCH_SENTINEL');
      await expect(page.locator(EDITOR_SELECTOR)).not.toContainText('TARGET_PREFETCH_SENTINEL');

      const clickStartedAt = Date.now();
      await targetRow.click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('TARGET_PREFETCH_SENTINEL', {
        timeout: 30_000,
      });
      const clickOpenMs = Date.now() - clickStartedAt;

      const finalCache = await getNoteContentCacheEntry(page, targetPath);
      console.info('[notes-hover-prefetch]', {
        clickOpenMs,
        finalCache,
      });

      expect(finalCache.currentNotePath).toBe(targetPath);
      expect(finalCache.hasEntry).toBe(true);
      expect(clickOpenMs).toBeLessThan(5_000);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('prefetches Chat session messages on hover without switching the active session', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('chat-hover-prefetch');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const fixture = await createChatFixture(page, {
        activeSessionIndex: 0,
        sessions: [
          {
            title: 'E2E Active Prefetch Chat',
            messages: [
              { role: 'user', content: 'Active prefetch prompt.' },
              { role: 'assistant', content: 'ACTIVE_CHAT_PREFETCH_SENTINEL rendered response.' },
            ],
          },
          {
            title: 'E2E Target Prefetch Chat',
            preloadMessages: false,
            messages: [
              { role: 'user', content: 'Target prefetch prompt.' },
              { role: 'assistant', content: 'TARGET_CHAT_PREFETCH_SENTINEL rendered response.' },
            ],
          },
        ],
      });
      const activeSessionId = fixture.sessionIds[0]!;
      const targetSessionId = fixture.sessionIds[1]!;

      await setAppViewMode(page, 'chat');
      await waitForChatSession(page, {
        sessionId: activeSessionId,
        minMessageCount: 2,
        sentinelText: 'ACTIVE_CHAT_PREFETCH_SENTINEL',
      });
      await expect(page.locator(CHAT_VIEW_SELECTOR)).not.toContainText('TARGET_CHAT_PREFETCH_SENTINEL');

      await expect.poll(() => getChatSessionMessageStatus(page, targetSessionId), { timeout: 10_000 }).toMatchObject({
        currentSessionId: activeSessionId,
        hasMessages: false,
        messageCount: 0,
      });

      const targetRow = page.locator(CHAT_SESSION_ROW_SELECTOR, { hasText: 'E2E Target Prefetch Chat' }).first();
      await expect(targetRow).toBeVisible();
      await targetRow.hover();

      await expect.poll(() => getChatSessionMessageStatus(page, targetSessionId), { timeout: 10_000 }).toMatchObject({
        currentSessionId: activeSessionId,
        hasMessages: true,
        messageCount: 2,
        lastContent: expect.stringContaining('TARGET_CHAT_PREFETCH_SENTINEL'),
      });

      await expect(page.locator(CHAT_VIEW_SELECTOR)).toContainText('ACTIVE_CHAT_PREFETCH_SENTINEL');
      await expect(page.locator(CHAT_VIEW_SELECTOR)).not.toContainText('TARGET_CHAT_PREFETCH_SENTINEL');

      const switchStartedAt = Date.now();
      await targetRow.click();
      await waitForChatSession(page, {
        sessionId: targetSessionId,
        minMessageCount: 2,
        sentinelText: 'TARGET_CHAT_PREFETCH_SENTINEL',
      });
      const switchMs = Date.now() - switchStartedAt;

      const finalStatus = await getChatSessionMessageStatus(page, targetSessionId);
      console.info('[chat-hover-prefetch]', {
        switchMs,
        finalStatus,
      });

      expect(finalStatus.currentSessionId).toBe(targetSessionId);
      expect(finalStatus.hasMessages).toBe(true);
      expect(switchMs).toBeLessThan(5_000);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
