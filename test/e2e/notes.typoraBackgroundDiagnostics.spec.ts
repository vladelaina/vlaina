import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  FILE_TREE_FILE_SELECTOR,
  cleanupIsolatedElectron,
  createNotesRootFilesFixture,
  getOpenBridgePages,
  installReferenceTyporaTheme,
  launchIsolatedElectron,
  openNotesRootInNotes,
} from './notesE2E';

test.describe('Typora imported theme backgrounds', () => {
  test.setTimeout(120_000);

  test('applies the Typora document background image to the Notes body root', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('typora-background-image');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const fixture = await createNotesRootFilesFixture(page, {
        name: 'typora-background-image',
        files: [{
          filename: 'typora-background-image.md',
          content: [
            '# Typora Background Image',
            '',
            'This note exists so the regression can inspect the live editor background.',
            '',
            '## Section',
            '',
            'A paragraph with enough body text to make the editor area visible.',
          ].join('\n'),
        }],
      });

      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Typora Background Image',
        minFileCount: 1,
      });
      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'typora-background-image' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('live editor background', {
        timeout: 30_000,
      });

      const installedTheme = await installReferenceTyporaTheme(page, 'vlook-fancy.css');
      test.skip(
        Boolean(installedTheme.skipped),
        installedTheme.skipReason ?? 'Reference Typora theme is not available in this checkout',
      );
      const background = await page.locator('[data-note-content-root="true"]').evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          typoraDocumentImage: style.getPropertyValue('--d-bi').trim(),
          milkdownBackgroundColor: getComputedStyle(element.querySelector<HTMLElement>('.milkdown')!).backgroundColor,
          proseMirrorBackgroundColor: getComputedStyle(element.querySelector<HTMLElement>('.ProseMirror')!).backgroundColor,
        };
      });

      expect(background.backgroundColor).toBe('rgb(250, 249, 245)');
      expect(background.typoraDocumentImage).toContain('data:image/png;base64');
      expect(background.backgroundImage).toContain('data:image/png;base64');
      expect(background.milkdownBackgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(background.proseMirrorBackgroundColor).toBe('rgba(0, 0, 0, 0)');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
