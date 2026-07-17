import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
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
import {
  parityPrelude,
  phycatThemes,
  styleTargets,
} from './notesTyporaPhycatParityData';

const referenceRoot = path.join(process.cwd(), '.reference', 'typora-theme-phycat');

async function readComputedStyle(
  page: Page,
  selector: string,
  properties: string[],
  pseudo?: '::before' | '::after' | '::marker',
) {
  const locator = page.locator(selector).first();
  await expect(locator, `Missing parity target ${selector}`).toBeAttached();
  return locator.evaluate((element, args) => {
    const style = getComputedStyle(element, args.pseudo);
    return Object.fromEntries(args.properties.map((property) => [property, style.getPropertyValue(property)]));
  }, { properties, pseudo });
}

async function setAppColorModePreference(page: Page, colorMode: 'light' | 'dark') {
  await page.evaluate((mode) => (window as any).__vlainaE2E.setUIPreferences({ colorMode: mode }), colorMode);
  await expect.poll(() => page.evaluate(() => (window as any).__vlainaE2E.getUIState().colorMode))
    .toBe(colorMode);
  await expect(page.locator('html')).toHaveClass(/(^|\s)light(\s|$)/);
}

test.describe('Phycat Typora rendering parity', () => {
  test.setTimeout(240_000);

  test('matches the official exported demos across all available themes', async () => {
    const demoMarkdownPath = path.join(referenceRoot, 'demo', 'demo.md');
    const demoMarkdown = await fs.readFile(demoMarkdownPath, 'utf8').catch(() => null);
    test.skip(!demoMarkdown, `Missing Phycat demo Markdown ${demoMarkdownPath}`);

    const { app, userDataRoot } = await launchIsolatedElectron('typora-phycat-parity');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1800, height: 1000 });
      const fixture = await createNotesRootFilesFixture(page, {
        name: 'typora-phycat-parity',
        files: [{
          filename: 'phycat-parity.md',
          content: `${parityPrelude}\n\n${demoMarkdown!}`,
        }],
      });
      await openNotesRootInNotes(page, {
        notesRootPath: fixture.notesRootPath,
        name: 'Phycat Parity',
        minFileCount: 1,
      });
      await page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'phycat-parity' }).first().click();
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('咖啡的炼金术', { timeout: 30_000 });

      for (const theme of phycatThemes) {
        await test.step(theme, async () => {
          const htmlPath = path.join(referenceRoot, 'demo', `demo-${theme}.html`);
          const hasReferenceHtml = await fs.access(htmlPath).then(() => true, () => false);
          test.skip(!hasReferenceHtml, `Missing Phycat reference HTML ${htmlPath}`);

          const installed = await installReferenceTyporaTheme(page, `phycat-${theme}.css`);
          test.skip(Boolean(installed.skipped), installed.skipReason ?? `Missing Phycat ${theme}`);
          await expect(page.locator('#write')).toHaveAttribute('data-markdown-theme-platform', 'typora');
          await setAppColorModePreference(page, 'light');

          await app.evaluate(async ({ BrowserWindow }, referencePath) => {
            const referenceWindow = new BrowserWindow({
              show: false,
              width: 1800,
              height: 1000,
              webPreferences: { backgroundThrottling: false },
            });
            await referenceWindow.loadFile(referencePath);
          }, htmlPath);
          const referencePage = app.windows().find((candidate) => candidate.url().startsWith('file:'));
          expect(referencePage, `Missing Electron reference page for ${theme}`).toBeDefined();
          try {
            expect(referencePage!.url()).toBe(pathToFileURL(htmlPath).href);
            await referencePage!.setViewportSize({ width: 1800, height: 1000 });
            await expect(referencePage!.locator('#write')).toBeAttached();
            await referencePage!.evaluate(() => {
              const write = document.querySelector('#write');
              write?.insertAdjacentHTML('afterbegin', [
                '<h4>Phycat parity heading four</h4>',
                '<h5>Phycat parity heading five</h5>',
                '<h6>Phycat parity heading six</h6>',
                '<p><del>deleted parity</del></p>',
                '<ul><li id="vlaina-parity-task" class="task-list-item"><input type="checkbox"><p>Task parity item</p></li></ul>',
              ].join(''));
            });
            await referencePage!.evaluate(() => document.fonts.ready);
            await page.evaluate(() => document.fonts.ready);
            await page.locator('#write .mermaid-block').first().scrollIntoViewIfNeeded();
            await expect(page.locator('#write .mermaid-block svg').first()).toBeAttached({ timeout: 30_000 });

            const lightModeStyles: Record<string, Record<string, string>> = {};

            for (const target of styleTargets) {
              if (await referencePage!.locator(target.referenceSelector).count() === 0) continue;
              const referenceStyle = await readComputedStyle(
                referencePage!,
                target.referenceSelector,
                target.properties,
                target.referencePseudo ?? target.pseudo,
              );
              const appStyle = await readComputedStyle(
                page,
                target.appSelector,
                target.properties,
                target.appPseudo ?? target.pseudo,
              );
              lightModeStyles[target.name] = appStyle;
              expect(appStyle, `${theme}: ${target.name}`).toEqual(referenceStyle);
            }

            const sidebarLightStyle = await readComputedStyle(
              page, '[data-sidebar-surface="true"]', ['color', 'background-color'],
            );
            const activeFileLightStyle = await readComputedStyle(
              page, `${FILE_TREE_FILE_SELECTOR} > div > div`, ['color', 'background-color'],
            );

            await setAppColorModePreference(page, 'dark');
            expect(await readComputedStyle(
              page, '[data-sidebar-surface="true"]', ['color', 'background-color'],
            ), `${theme}: sidebar changed with app color mode`).toEqual(sidebarLightStyle);
            expect(await readComputedStyle(
              page, `${FILE_TREE_FILE_SELECTOR} > div > div`, ['color', 'background-color'],
            ), `${theme}: active file changed with app color mode`).toEqual(activeFileLightStyle);
            for (const target of styleTargets) {
              if (!(target.name in lightModeStyles)) continue;
              const darkModeStyle = await readComputedStyle(
                page,
                target.appSelector,
                target.properties,
                target.appPseudo ?? target.pseudo,
              );
              expect(darkModeStyle, `${theme}: ${target.name} changed with app color mode`)
                .toEqual(lightModeStyles[target.name]);
            }
          } finally {
            await referencePage?.close();
          }
        });
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
