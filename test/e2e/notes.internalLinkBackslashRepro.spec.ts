import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openAbsoluteNote,
  openMarkdownFixture,
  waitForEditorAnimationFrame,
} from './notesE2E';

type LinkBackslashReport = {
  anchors: Array<{
    href: string | null;
    text: string;
    nextText: string;
    nextIsBackslashHardBreakSource: boolean;
    parentText: string;
  }>;
  hardBreakSourceCount: number;
  markdown: string;
};

async function readInternalLinkBackslashReport(page: Page): Promise<LinkBackslashReport> {
  await waitForEditorAnimationFrame(page);
  return page.locator(EDITOR_SELECTOR).evaluate((editor) => {
    const anchors = Array.from(editor.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .filter((anchor) => {
        const href = anchor.getAttribute('href') ?? '';
        return href.endsWith('.md') ||
          href.includes('.md#') ||
          href.includes('.md?') ||
          href.startsWith('./') ||
          href.startsWith('../');
      })
      .map((anchor) => {
        const next = anchor.nextSibling;
        const nextElement = next instanceof HTMLElement ? next : null;
        return {
          href: anchor.getAttribute('href'),
          text: anchor.textContent ?? '',
          nextText: next?.textContent ?? '',
          nextIsBackslashHardBreakSource: Boolean(
            nextElement?.matches('[data-vlaina-backslash-hard-break-source-text="true"]') ||
              nextElement?.querySelector('[data-vlaina-backslash-hard-break-source-text="true"]'),
          ),
          parentText: anchor.parentElement?.textContent ?? '',
        };
      });

    return {
      anchors,
      hardBreakSourceCount: editor.querySelectorAll('[data-vlaina-backslash-hard-break-source-text="true"]').length,
      markdown: String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? ''),
    };
  });
}

async function expectInternalLinkTextsWithoutTrailingBackslash(
  page: Page,
  label: string,
  minLinks = 5,
): Promise<LinkBackslashReport> {
  const report = await readInternalLinkBackslashReport(page);
  expect(report.anchors.length, `${label} should render internal links`).toBeGreaterThanOrEqual(minLinks);
  for (const anchor of report.anchors) {
    expect(anchor.text, `${label} link ${anchor.href} should not include a trailing backslash`).not.toMatch(/\\$/);
  }
  return report;
}

test.describe('notes internal link backslash repro', () => {
  test.setTimeout(120_000);

  test('keeps internal link text clean across open, save, keyboard input, and reopen', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-internal-link-backslash-repro');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      const initialMarkdown = [
        '# Internal Link Backslash Repro',
        '',
        'Plain line link: [plain internal](plain.md)',
        '',
        'Relative line link: [relative internal](./relative.md#target)',
        '',
        'Query line link: [query internal](notes/query.md?x=1)',
        '',
        'Paren line link: [paren internal](notes/a\\(b\\).md)',
        '',
        'Angle line link: [angle internal](<notes/file name.md>)',
        '',
        'Hard break link: [hard break internal](hard-break.md)\\',
        'next visual line after hard break.',
        '',
        'Link followed by punctuation: [punct internal](punct.md).',
      ].join('\n');

      const opened = await openMarkdownFixture(page, {
        filename: 'internal-link-backslash-repro.md',
        content: initialMarkdown,
      });

      const openedReport = await expectInternalLinkTextsWithoutTrailingBackslash(page, 'opened');
      expect(openedReport.hardBreakSourceCount, 'opened should expose only the intentional hard-break source').toBe(1);
      expect(openedReport.anchors.find((anchor) => anchor.href === 'hard-break.md')).toMatchObject({
        text: 'hard break internal',
        nextText: '\\',
      });

      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      await openAbsoluteNote(page, opened.notePath);

      const reopenedReport = await expectInternalLinkTextsWithoutTrailingBackslash(page, 'reopened');
      expect(reopenedReport.markdown).toBe(initialMarkdown);
      expect(reopenedReport.hardBreakSourceCount, 'reopened should keep one intentional hard-break source').toBe(1);
      expect(reopenedReport.anchors.find((anchor) => anchor.href === 'hard-break.md')).toMatchObject({
        text: 'hard break internal',
        nextText: '\\',
      });

      const typed = await openMarkdownFixture(page, {
        filename: 'internal-link-backslash-typed.md',
        content: '',
      });
      await page.locator(EDITOR_SELECTOR).click({ position: { x: 32, y: 32 } });
      await page.keyboard.type('[typed internal](typed.md)');
      await page.keyboard.type(' ');
      await page.keyboard.type('after typed internal link');
      await page.keyboard.press('Enter');
      await page.keyboard.type('next paragraph after typed link');

      await expect.poll(async () => readInternalLinkBackslashReport(page), { timeout: 10_000 })
        .toMatchObject({
          anchors: [expect.objectContaining({ href: 'typed.md', text: 'typed internal' })],
          hardBreakSourceCount: 0,
        });

      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      await openAbsoluteNote(page, typed.notePath);
      const typedReopenedReport = await expectInternalLinkTextsWithoutTrailingBackslash(page, 'typed reopened', 1);
      expect(typedReopenedReport.hardBreakSourceCount, 'ordinary Enter after a typed link should not create a backslash').toBe(0);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
