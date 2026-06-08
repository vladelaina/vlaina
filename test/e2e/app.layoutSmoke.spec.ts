import { expect, test } from '@playwright/test';
import {
  CHAT_COMPOSER_TEXTAREA_SELECTOR,
  CHAT_SCROLLABLE_SELECTOR,
  CHAT_SESSION_ROW_SELECTOR,
  CHAT_VIEW_SELECTOR,
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  NOTES_SIDEBAR_SCROLL_ROOT_SELECTOR,
  NOTES_VIEW_SELECTOR,
  cleanupIsolatedElectron,
  collectLayoutSmokeMetrics,
  createChatFixture,
  createVaultFilesFixture,
  getOpenBridgePages,
  installReferenceTyporaTheme,
  launchIsolatedElectron,
  openVaultInNotes,
  setAppViewMode,
  waitForChatSession,
} from './notesE2E';

test.describe('app layout smoke', () => {
  test.setTimeout(120_000);

  test('keeps Notes and Chat primary surfaces visible without document overflow', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('app-layout-smoke');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const notesFixture = await createVaultFilesFixture(page, {
        name: 'layout-smoke',
        files: [
          {
            filename: 'layout-smoke.md',
            content: [
              '# Layout Smoke Note',
              '',
              'Layout smoke sentinel paragraph.',
              '',
              '| Surface | Expected |',
              '| --- | --- |',
              '| Sidebar | Visible |',
              '| Editor | Visible |',
              '',
              '```ts',
              'const layoutSmoke = true;',
              '```',
              '',
            ].join('\n'),
          },
        ],
      });
      const chatFixture = await createChatFixture(page, {
        sessions: [
          {
            title: 'E2E Layout Chat',
            messages: [
              { role: 'user', content: 'Layout smoke user prompt.' },
              { role: 'assistant', content: 'LAYOUT_CHAT_SENTINEL with **markdown** and a small table.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |' },
            ],
          },
        ],
      });

      await openVaultInNotes(page, {
        vaultPath: notesFixture.vaultPath,
        name: 'Layout Smoke Vault',
        minFileCount: 1,
      });
      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'layout-smoke' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Layout smoke sentinel paragraph', {
        timeout: 30_000,
      });
      const importedTheme = await installReferenceTyporaTheme(page, 'vlook-fancy.css');
      const notesBackground = await page.locator('[data-note-toolbar-root="true"]').evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          rootTheme: document.documentElement.getAttribute('data-vlaina-imported-app-theme'),
          background: style.background,
          backgroundImage: style.backgroundImage,
          importedLayer: style.getPropertyValue('--vlaina-imported-app-background-layer').trim(),
        };
      });
      expect(notesBackground.rootTheme).toBe(importedTheme.themeId);
      expect(notesBackground.importedLayer).not.toBe('');

      let notesLayout = await collectLayoutSmokeMetrics(page);
      console.info('[layout-smoke-notes-desktop]', notesLayout);
      expect(notesLayout.hasHorizontalDocumentOverflow).toBe(false);
      await expect(page.locator(NOTES_VIEW_SELECTOR)).toBeVisible();
      await expect(page.locator(NOTES_SIDEBAR_SCROLL_ROOT_SELECTOR).first()).toBeVisible();
      await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();

      await page.setViewportSize({ width: 900, height: 720 });
      notesLayout = await collectLayoutSmokeMetrics(page);
      console.info('[layout-smoke-notes-narrow]', notesLayout);
      expect(notesLayout.hasHorizontalDocumentOverflow).toBe(false);
      await expect(page.locator(NOTES_VIEW_SELECTOR)).toBeVisible();
      await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();

      await setAppViewMode(page, 'chat');
      await waitForChatSession(page, {
        sessionId: chatFixture.sessionIds[0]!,
        minMessageCount: 2,
        sentinelText: 'LAYOUT_CHAT_SENTINEL',
      });
      await expect(page.locator(CHAT_SESSION_ROW_SELECTOR, { hasText: 'E2E Layout Chat' })).toBeVisible();
      await expect(page.locator(CHAT_SCROLLABLE_SELECTOR)).toBeVisible();
      await expect(page.locator(CHAT_COMPOSER_TEXTAREA_SELECTOR)).toBeVisible();
      const chatBackground = await page.locator(CHAT_VIEW_SELECTOR).evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          rootTheme: document.documentElement.getAttribute('data-vlaina-imported-app-theme'),
          background: style.background,
          backgroundImage: style.backgroundImage,
          importedLayer: style.getPropertyValue('--vlaina-imported-app-background-layer').trim(),
        };
      });
      expect(chatBackground.rootTheme).toBe(importedTheme.themeId);
      expect(chatBackground.importedLayer).toBe(notesBackground.importedLayer);
      expect(chatBackground.backgroundImage).toBe(notesBackground.backgroundImage);

      let chatLayout = await collectLayoutSmokeMetrics(page);
      console.info('[layout-smoke-chat-narrow]', chatLayout);
      expect(chatLayout.hasHorizontalDocumentOverflow).toBe(false);
      await expect(page.locator(CHAT_VIEW_SELECTOR)).toBeVisible();

      await page.setViewportSize({ width: 1280, height: 860 });
      chatLayout = await collectLayoutSmokeMetrics(page);
      console.info('[layout-smoke-chat-desktop]', chatLayout);
      expect(chatLayout.hasHorizontalDocumentOverflow).toBe(false);
      await expect(page.locator(CHAT_VIEW_SELECTOR)).toBeVisible();

      await setAppViewMode(page, 'notes');
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Layout smoke sentinel paragraph');
      const finalNotesLayout = await collectLayoutSmokeMetrics(page);
      console.info('[layout-smoke-notes-return]', finalNotesLayout);
      expect(finalNotesLayout.hasHorizontalDocumentOverflow).toBe(false);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
