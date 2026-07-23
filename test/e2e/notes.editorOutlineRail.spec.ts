import { expect, test } from '@playwright/test';
import {
  NOTE_SCROLL_ROOT_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

const OUTLINE_RAIL_SELECTOR = '[data-editor-outline-rail="true"]';

test.describe('notes editor outline rail', () => {
  test('stays in the right-side whitespace and tracks the active heading', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-editor-outline-rail');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'editor-outline-rail.md',
        content: [
          '# Introduction',
          '',
          ...Array.from({ length: 12 }, (_, index) => `Opening paragraph ${index + 1}. ${'Context '.repeat(18)}`),
          '',
          '## Overview',
          '',
          ...Array.from({ length: 12 }, (_, index) => `Overview paragraph ${index + 1}. ${'Details '.repeat(18)}`),
          '',
          '### Deep Dive',
          '',
          ...Array.from({ length: 12 }, (_, index) => `Deep paragraph ${index + 1}. ${'Evidence '.repeat(18)}`),
          '',
          '#### Conclusion',
          '',
          'Closing paragraph.',
        ].join('\n'),
      });

      const rail = page.locator(OUTLINE_RAIL_SELECTOR);
      const outline = rail.getByRole('navigation', { name: 'Document outline' });
      const getGeometry = () => page.evaluate((selector) => {
        const railElement = document.querySelector<HTMLElement>(selector);
        const editorElement = document.querySelector<HTMLElement>('[data-note-content-root="true"]');
        const editorTextElement = editorElement?.querySelector<HTMLElement>('.ProseMirror');
        const rows = Array.from(
          railElement?.querySelectorAll<HTMLElement>('.editor-outline-row') ?? [],
        );
        if (!railElement || !editorTextElement || rows.length === 0) return null;
        const railRect = railElement.getBoundingClientRect();
        const editorTextRect = editorTextElement.getBoundingClientRect();
        return {
          editorTextRight: editorTextRect.right,
          railLeft: railRect.left,
          railRight: railRect.right,
          rowHeights: rows.map((row) => Math.round(row.getBoundingClientRect().height)),
          rowTextLefts: rows.map((row) => Math.round(
            row.querySelector<HTMLElement>('.editor-outline-row-text')?.getBoundingClientRect().left ?? 0,
          )),
          viewportWidth: window.innerWidth,
        };
      }, OUTLINE_RAIL_SELECTOR);

      await expect(rail).toBeVisible({ timeout: 10_000 });
      await expect(outline).toBeVisible();
      await expect(rail.locator('.editor-outline-header-icon')).toBeVisible();
      await expect(outline.getByRole('button')).toHaveText([
        'Introduction',
        'Overview',
        'Deep Dive',
        'Conclusion',
      ]);
      await expect(outline.locator('[aria-current="location"]')).toHaveText('Introduction');

      const geometry = await getGeometry();

      expect(geometry).not.toBeNull();
      expect(geometry!.railLeft).toBeGreaterThanOrEqual(geometry!.editorTextRight);
      expect(geometry!.railRight).toBeLessThan(geometry!.viewportWidth);
      expect(new Set(geometry!.rowHeights)).toEqual(new Set([28]));
      expect(geometry!.rowTextLefts[0]).toBeLessThan(geometry!.rowTextLefts[1]);
      expect(geometry!.rowTextLefts[1]).toBeLessThan(geometry!.rowTextLefts[2]);
      expect(geometry!.rowTextLefts[2]).toBeLessThan(geometry!.rowTextLefts[3]);

      await outline.getByRole('button', { name: 'Deep Dive' }).click();

      await expect.poll(async () => page.locator(NOTE_SCROLL_ROOT_SELECTOR).evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      await expect(outline.locator('.editor-outline-row-active')).toHaveText('Deep Dive');
      await expect(outline.locator('.editor-outline-row-active')).toHaveAttribute('data-level', '3');

      await page.setViewportSize({ width: 700, height: 860 });
      await expect(rail).toBeVisible();
      const narrowGeometry = await getGeometry();
      expect(narrowGeometry).not.toBeNull();
      expect(narrowGeometry!.railLeft).toBeGreaterThanOrEqual(narrowGeometry!.editorTextRight);
      expect(narrowGeometry!.railRight).toBeLessThan(narrowGeometry!.viewportWidth);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
