import { expect, test, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const EDITOR_SELECTOR = '.milkdown .ProseMirror';
const SELECTED_BLOCK_SELECTOR = `${EDITOR_SELECTOR} .editor-block-selected`;
const BLOCK_CONTROLS_SELECTOR = '.editor-block-controls.visible';

async function waitForE2EBridge(page: Page) {
  await page.waitForFunction(() => Boolean((window as any).__vlainaE2E));
  await page.evaluate(() => (window as any).__vlainaE2E.waitForUnifiedLoaded());
}

async function getOpenBridgePages(app: ElectronApplication, count: number): Promise<Page[]> {
  await expect.poll(() => app.windows().filter((page) => !page.isClosed()).length).toBeGreaterThanOrEqual(count);
  const pages = app.windows().filter((page) => !page.isClosed()).slice(0, count);
  await Promise.all(pages.map(waitForE2EBridge));
  return pages;
}

async function launchIsolatedElectron(): Promise<{
  app: ElectronApplication;
  userDataDir: string;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vlaina-block-selection-e2e-'));
  const userDataDir = path.join(root, 'user-data');

  const app = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: 'http://127.0.0.1:3100?e2e=1',
      VLAINA_USER_DATA_DIR: userDataDir,
      APP_API_BASE_URL: 'http://127.0.0.1:9',
      APP_UPDATE_MANIFEST_URL: 'http://127.0.0.1:9/latest',
      NO_PROXY: '127.0.0.1,localhost',
      no_proxy: '127.0.0.1,localhost',
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      ALL_PROXY: '',
      http_proxy: '',
      https_proxy: '',
      all_proxy: '',
    },
  });

  return { app, userDataDir: root };
}

async function closeElectron(app: ElectronApplication): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  await Promise.race([
    app.close().finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }),
    new Promise<void>((resolve) => {
      timeoutId = setTimeout(() => {
        app.process()?.kill('SIGKILL');
        resolve();
      }, 5000);
    }),
  ]).catch(() => {
    app.process()?.kill('SIGKILL');
  });
}

async function openBlockSelectionFixture(page: Page): Promise<void> {
  const { notePath } = await page.evaluate(() =>
    (window as any).__vlainaE2E.createNotesFixture({
      filename: 'block-selection.md',
      content: [
        '# Block Selection',
        '',
        'First selectable paragraph',
        '',
        'Second selectable paragraph',
        '',
        '- Parent item',
        '  ```js',
        '  const value = 1',
        '  ```',
        '',
        'Final paragraph',
        '',
      ].join('\n'),
    })
  );

  await page.evaluate((pathToOpen) => (window as any).__vlainaE2E.openAbsoluteNote(pathToOpen), notePath);
  await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();
  await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'First selectable paragraph' })).toBeVisible();
  await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Second selectable paragraph' })).toBeVisible();
}

async function expectSelectedParagraphs(page: Page, texts: string[]): Promise<void> {
  await expect.poll(async () => page.evaluate((expectedTexts) => {
    const selected = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror .editor-block-selected'));
    return expectedTexts.map((text) => selected.some((element) => element.textContent?.includes(text)));
  }, texts)).toEqual(texts.map(() => true));
}

test.describe('notes block selection', () => {
  test.setTimeout(90_000);

  test('selects blocks from the text gutter and centers the drag handle on the selected block', async () => {
    const { app, userDataDir } = await launchIsolatedElectron();

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openBlockSelectionFixture(page);

      await expect.poll(async () => page.evaluate(() => (window as any).__vlainaE2E.getNoteSelectableBlocks()))
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ tagName: 'P', text: 'First selectable paragraph' }),
          expect.objectContaining({ tagName: 'P', text: 'Second selectable paragraph' }),
        ]));

      await expect(
        page.evaluate(() => (window as any).__vlainaE2E.selectNoteBlocksByText([
          'First selectable paragraph',
          'Second selectable paragraph',
        ]))
      ).resolves.toBe(2);
      await expectSelectedParagraphs(page, ['First selectable paragraph', 'Second selectable paragraph']);

      const firstSelected = page.locator(SELECTED_BLOCK_SELECTOR).first();
      const selectedRect = await firstSelected.boundingBox();
      if (!selectedRect) {
        throw new Error('Could not resolve selected block geometry');
      }

      await page.mouse.move(Math.max(8, selectedRect.x - 18), selectedRect.y + selectedRect.height / 2);
      await expect(page.locator(BLOCK_CONTROLS_SELECTOR)).toBeVisible();

      const geometry = await page.evaluate(() => {
        const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible');
        const selected = document.querySelector<HTMLElement>('.milkdown .ProseMirror .editor-block-selected');
        if (!controls || !selected) return null;
        const controlsRect = controls.getBoundingClientRect();
        const selectedRect = selected.getBoundingClientRect();
        return {
          controlsCenterY: controlsRect.top + controlsRect.height / 2,
          selectedCenterY: selectedRect.top + selectedRect.height / 2,
          controlsLeft: controlsRect.left,
          selectedLeft: selectedRect.left,
        };
      });

      expect(geometry).not.toBeNull();
      expect(Math.abs(geometry!.controlsCenterY - geometry!.selectedCenterY)).toBeLessThanOrEqual(2);
      expect(geometry!.controlsLeft).toBeLessThan(geometry!.selectedLeft);
    } finally {
      await closeElectron(app);
      await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
