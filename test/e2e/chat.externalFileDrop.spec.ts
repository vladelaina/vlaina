import { expect, test, type Page } from '@playwright/test';
import {
  CHAT_COMPOSER_TEXTAREA_SELECTOR,
  cleanupIsolatedElectron,
  createChatModelFixture,
  createVaultFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openVaultInNotes,
} from './notesE2E';

async function dispatchMarkdownFileDropIntoEmbeddedChat(
  page: Page,
  input: { absolutePath: string; fileName: string },
) {
  return page.evaluate(({ absolutePath, fileName }) => {
    const composer = document.querySelector<HTMLElement>('[data-notes-chat-panel="true"] [data-chat-input="true"]');
    if (!composer) {
      return {
        dropped: false,
        defaultPrevented: false,
        reason: 'missing-composer',
        transferredPath: null,
        notesPath: null,
        currentVaultPath: null,
        textareaValue: null,
      };
    }

    const file = new File(['Dragged note body.'], fileName, { type: 'text/markdown' });
    Object.defineProperty(file, 'path', {
      value: absolutePath,
      configurable: true,
    });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    dataTransfer.effectAllowed = 'copy';

    const rect = composer.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    for (const type of ['dragenter', 'dragover'] as const) {
      composer.dispatchEvent(new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        dataTransfer,
      }));
    }

    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      dataTransfer,
    });
    const dropped = composer.dispatchEvent(dropEvent);

    return {
      dropped,
      defaultPrevented: dropEvent.defaultPrevented,
      reason: null,
      transferredPath: (dataTransfer.files[0] as File & { path?: string } | undefined)?.path ?? null,
      notesPath: (window as any).__vlainaE2E.getNotesState().notesPath ?? null,
      currentVaultPath: (window as any).__vlainaE2E.getVaultState().currentVault?.path ?? null,
      textareaValue: document.querySelector<HTMLTextAreaElement>('[data-notes-chat-panel="true"] [data-chat-input="true"] textarea')?.value ?? null,
    };
  }, input);
}

test.describe('chat external file drop coverage', () => {
  test.setTimeout(120_000);

  test('adds a note mention when a current-vault markdown file is dropped into embedded chat', async ({}, testInfo) => {
    const { app, userDataRoot } = await launchIsolatedElectron(`chat-external-file-drop-${testInfo.workerIndex}`);

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await createChatModelFixture(page, {
        providerName: 'E2E External File Drop Provider',
        apiModelId: 'e2e-external-file-drop-model',
      });

      const fixture = await createVaultFilesFixture(page, {
        name: 'chat-external-file-drop',
        files: [
          { filename: 'Dragged.md', content: 'Dragged note body.' },
          { filename: 'Anchor.md', content: 'Anchor note body.' },
        ],
      });
      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'External File Drop Vault',
        minFileCount: 2,
      });

      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({
        notesChatPanelCollapsed: false,
      }));
      await expect(page.locator('[data-notes-chat-panel="true"]')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(`[data-notes-chat-panel="true"] ${CHAT_COMPOSER_TEXTAREA_SELECTOR}`))
        .toBeVisible({ timeout: 30_000 });

      const result = await dispatchMarkdownFileDropIntoEmbeddedChat(page, {
        absolutePath: fixture.notePaths[0],
        fileName: 'Dragged.md',
      });

      expect(result.reason).toBeNull();
      expect(result.defaultPrevented).toBe(true);
      expect(result.transferredPath).toBe(fixture.notePaths[0]);
      await expect(
        page.locator(`[data-notes-chat-panel="true"] ${CHAT_COMPOSER_TEXTAREA_SELECTOR}`),
        JSON.stringify(result, null, 2),
      )
        .toHaveValue('@Dragged ', { timeout: 10_000 });
      await expect(page.locator('[data-notes-chat-panel="true"] [data-mention-preview-token="true"]'))
        .toContainText('@Dragged', { timeout: 10_000 });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
