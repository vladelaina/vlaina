import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

test.describe('notes mermaid render regressions', () => {
  test.setTimeout(120_000);

  test('does not leak Mermaid syntax error text into the app shell', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-mermaid-syntax-error-leak');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'mermaid-syntax-error-leak.md',
        content: [
          'Paragraph before invalid Mermaid.',
          '',
          '```mermaid',
          'not a diagram',
          '```',
          '',
          'Paragraph after invalid Mermaid.',
        ].join('\n'),
      });

      await expect(page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"] .mermaid-error`)).toBeVisible();

      const leaked = await page.evaluate(() => ({
        bodyText: document.body.textContent ?? '',
        temporaryMermaidHostCount: document.querySelectorAll(
          '[data-mermaid-render-host="true"], [id^="dmermaid-"], [id^="imermaid-"]'
        ).length,
      }));

      expect(leaked.bodyText).not.toContain('Syntax error in text');
      expect(leaked.temporaryMermaidHostCount, JSON.stringify(leaked, null, 2)).toBe(0);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
