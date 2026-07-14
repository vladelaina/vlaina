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

  test('preserves the Phycat document texture on the editable Typora root', async () => {
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

      const installedTheme = await installReferenceTyporaTheme(page, 'phycat-sky.css');
      test.skip(
        Boolean(installedTheme.skipped),
        installedTheme.skipReason ?? 'Reference Typora theme is not available in this checkout',
      );
      const background = await page.locator('#write').evaluate((element) => {
        const style = getComputedStyle(element);
        const paper = getComputedStyle(element, '::before');
        return {
          platform: element.getAttribute('data-markdown-theme-platform'),
          elementColor: style.getPropertyValue('--element-color').trim(),
          backgroundStyle: style.getPropertyValue('--bg-style').trim(),
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          maxWidth: style.maxWidth,
          paperBackgroundColor: paper.backgroundColor,
          paperMaskImage: paper.maskImage,
          paperOpacity: paper.opacity,
          paperPointerEvents: paper.pointerEvents,
        };
      });

      expect(background).toMatchObject({
        platform: 'typora',
        elementColor: '#3498db',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        backgroundImage: 'none',
        maxWidth: 'min(100%, 950px)',
        paperBackgroundColor: 'rgb(52, 152, 219)',
        paperOpacity: '0.12',
        paperPointerEvents: 'none',
      });
      expect(background.paperMaskImage).not.toBe('none');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
