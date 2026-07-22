import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  EDITOR_SELECTOR,
  NOTE_IMAGE_BLOCK_SELECTOR,
  NOTE_SOURCE_FALLBACK_SELECTOR,
  cleanupIsolatedElectron,
  createNotesRootFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openAbsoluteNote,
  waitForEditorAnimationFrame,
} from './notesE2E';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function createLocalSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90">',
    '<rect width="160" height="90" fill="#2563eb"/>',
    '<circle cx="45" cy="45" r="24" fill="#f8fafc"/>',
    '<path d="M80 28h56v12H80zm0 22h40v12H80z" fill="#bfdbfe"/>',
    '</svg>',
  ].join('');
}

function createCompletenessMarkdown(): string {
  return [
    '# Rich Markdown Completeness',
    '',
    '![Local image 中文 sentinel](./assets/本地%20image.svg)',
    '',
    '| Feature | Status | Detail |',
    '| :--- | :---: | ---: |',
    '| Table sentinel | **Editable** | `a \\| b` |',
    '',
    'Inline formula sentinel $a^2 + b^2 = c^2$.',
    '',
    '$$',
    '\\int_0^1 x^2 \\, dx = \\frac{1}{3}',
    '$$',
    '',
    '```mermaid',
    'flowchart TD',
    '  Start[Completeness start] --> Check{All supported?}',
    '  Check -->|Yes| Done[Completeness done]',
    '```',
    '',
    'Round-trip tail sentinel.',
  ].join('\n');
}

async function expectImageReady(imageBlock: Locator): Promise<void> {
  await imageBlock.scrollIntoViewIfNeeded();
  await expect(imageBlock).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => imageBlock.locator('img').evaluate((image) => ({
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  })), { timeout: 30_000 }).toEqual({
    complete: true,
    naturalWidth: expect.any(Number),
    naturalHeight: expect.any(Number),
  });
  const dimensions = await imageBlock.locator('img').evaluate((image) => ({
    width: image.naturalWidth,
    height: image.naturalHeight,
  }));
  expect(dimensions.width).toBeGreaterThan(0);
  expect(dimensions.height).toBeGreaterThan(0);
}

async function expectRichMarkdownRendered(page: Page): Promise<void> {
  await expect(page.locator(NOTE_SOURCE_FALLBACK_SELECTOR)).toHaveCount(0);
  await expectImageReady(
    page.locator(`${NOTE_IMAGE_BLOCK_SELECTOR}[data-alt="Local image 中文 sentinel"]`),
  );
  await expect(page.locator(`${EDITOR_SELECTOR} table`, { hasText: 'Table sentinel' })).toBeVisible();
  await expect(page.locator(`${EDITOR_SELECTOR} table strong`, { hasText: 'Editable' })).toBeVisible();
  await expect(page.locator(`${EDITOR_SELECTOR} table code`, { hasText: 'a | b' })).toBeVisible();
  await expect(page.locator(`${EDITOR_SELECTOR} span[data-type="math-inline"] .katex`)).toHaveCount(1);
  await expect(page.locator(`${EDITOR_SELECTOR} div[data-type="math-block"] .katex`)).toHaveCount(1);
  const mermaid = page.locator(`${EDITOR_SELECTOR} div[data-type="mermaid"]`);
  await mermaid.scrollIntoViewIfNeeded();
  await expect(mermaid.locator('svg')).toBeVisible({ timeout: 30_000 });
  await expect(mermaid.locator('.mermaid-error')).toHaveCount(0);
}

async function dispatchImageTransfer(
  page: Page,
  type: 'paste' | 'drop',
  fileName: string,
): Promise<void> {
  const result = await page.evaluate(({ editorSelector, eventType, name, base64 }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) return { reason: 'missing-editor', defaultPrevented: false };

    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const file = new File([bytes], name, {
      type: 'image/png',
      lastModified: Date.now() - 10_000,
    });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    dataTransfer.effectAllowed = 'copy';

    if (eventType === 'paste') {
      const event = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      });
      editor.dispatchEvent(event);
      return { reason: null, defaultPrevented: event.defaultPrevented };
    }

    const rect = editor.getBoundingClientRect();
    const clientX = rect.left + Math.min(48, rect.width / 2);
    const clientY = rect.bottom - Math.min(48, rect.height / 2);
    for (const dragType of ['dragenter', 'dragover'] as const) {
      editor.dispatchEvent(new DragEvent(dragType, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        dataTransfer,
      }));
    }
    const event = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      dataTransfer,
    });
    editor.dispatchEvent(event);
    return { reason: null, defaultPrevented: event.defaultPrevented };
  }, {
    editorSelector: EDITOR_SELECTOR,
    eventType: type,
    name: fileName,
    base64: TINY_PNG_BASE64,
  });

  expect(result.reason).toBeNull();
  expect(result.defaultPrevented).toBe(true);
  await waitForEditorAnimationFrame(page);
}

test.describe('notes rich Markdown completeness', () => {
  test.setTimeout(180_000);

  test('renders and round-trips local images, tables, formulas, and Mermaid together', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-rich-markdown-completeness');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 900 });

      const fixture = await createNotesRootFilesFixture(page, {
        name: 'rich-markdown-completeness',
        files: [
          { filename: 'docs/complete.md', content: createCompletenessMarkdown() },
          { filename: 'docs/assets/本地 image.svg', content: createLocalSvg() },
          { filename: 'other.md', content: '# Other note' },
        ],
      });
      const notePath = fixture.notePaths[0]!;
      const otherNotePath = path.join(fixture.notesRootPath, 'other.md');

      await openAbsoluteNote(page, notePath);
      await expectRichMarkdownRendered(page);

      const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
      expect(focused).toBe(true);
      await page.keyboard.type(' Persisted completeness edit.');
      await expect.poll(async () => page.evaluate(() =>
        String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
      )).toContain('Persisted completeness edit.');

      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      const saved = await page.evaluate((pathToRead) =>
        (window as any).__vlainaE2E.readTextFile(pathToRead), notePath);
      expect(saved).toContain('本地%20image.svg');
      expect(saved).toContain('Table sentinel');
      expect(saved).toContain('a^2 + b^2 = c^2');
      expect(saved).toContain('flowchart TD');
      expect(saved).toContain('Persisted completeness edit.');

      await openAbsoluteNote(page, otherNotePath);
      await openAbsoluteNote(page, notePath);
      await expectRichMarkdownRendered(page);
      const reopened = await page.evaluate(() =>
        String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
      );
      expect(reopened).toBe(saved);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('persists pasted and dropped image files beside a nested note', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-image-transfer-completeness');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'image-transfer-completeness',
        files: [
          { filename: 'daily/upload.md', content: '# Image transfer\n\nTransfer tail.' },
          { filename: 'other.md', content: '# Other note' },
        ],
      });
      const notePath = fixture.notePaths[0]!;

      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({
        imageStorageMode: 'subfolder',
        imageSubfolderName: 'assets',
        imageFilenameFormat: 'original',
      }));
      await openAbsoluteNote(page, notePath);

      for (const [eventType, fileName] of [
        ['paste', 'pasted-note-image.png'],
        ['drop', 'dropped-note-image.png'],
      ] as const) {
        const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
        expect(focused).toBe(true);
        await dispatchImageTransfer(page, eventType, fileName);

        const imageBlock = page.locator(`${NOTE_IMAGE_BLOCK_SELECTOR}[data-src="./assets/${fileName}"]`);
        await expectImageReady(imageBlock);
        await expect.poll(async () => page.evaluate((expectedName) =>
          String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '').includes(expectedName),
        fileName)).toBe(true);

        const storedBytes = await fs.readFile(path.join(path.dirname(notePath), 'assets', fileName));
        expect(storedBytes.byteLength).toBeGreaterThan(0);
      }

      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      const saved = await page.evaluate((pathToRead) =>
        (window as any).__vlainaE2E.readTextFile(pathToRead), notePath);
      expect(saved).toContain('./assets/pasted-note-image.png');
      expect(saved).toContain('./assets/dropped-note-image.png');

      await openAbsoluteNote(page, path.join(fixture.notesRootPath, 'other.md'));
      await openAbsoluteNote(page, notePath);
      await expectImageReady(
        page.locator(`${NOTE_IMAGE_BLOCK_SELECTOR}[data-src="./assets/pasted-note-image.png"]`),
      );
      await expectImageReady(
        page.locator(`${NOTE_IMAGE_BLOCK_SELECTOR}[data-src="./assets/dropped-note-image.png"]`),
      );
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
