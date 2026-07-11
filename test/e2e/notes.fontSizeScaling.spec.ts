import { expect, test } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

test.describe('notes font size scaling', () => {
  test.setTimeout(120_000);

  test('scales the note title and markdown headings from the markdown body font size', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-font-size-scaling');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });
      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({ fontSize: 120 }));

      await openMarkdownFixture(page, {
        filename: 'very-long-title-for-clipping-check.md',
        content: ['# Heading One', '', '###### Heading Six', '', 'Paragraph body'].join('\n'),
      });

      await expect.poll(async () => page.evaluate(() => {
        const body = document.querySelector<HTMLElement>('.milkdown .ProseMirror p');
        return body ? Number.parseFloat(getComputedStyle(body).fontSize) : 0;
      })).toBe(120);

      const sizes = await page.evaluate(() => {
        const readFontSize = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector);
          return element ? Number.parseFloat(getComputedStyle(element).fontSize) : 0;
        };

        return {
          title: readFontSize('[data-note-title-input="true"]'),
          headingOne: readFontSize('.milkdown .ProseMirror h1'),
          headingSix: readFontSize('.milkdown .ProseMirror h6'),
          body: readFontSize('.milkdown .ProseMirror p'),
        };
      });

      expect(sizes.title / sizes.body).toBeCloseTo(1.882352941, 2);
      expect(sizes.headingOne / sizes.body).toBeCloseTo(2, 2);
      expect(sizes.headingSix / sizes.body).toBeCloseTo(1, 2);

      const titleToHeadingGap = await page.evaluate(() => {
        const title = document.querySelector<HTMLElement>('[data-note-title-input="true"]');
        const heading = document.querySelector<HTMLElement>('.milkdown .ProseMirror h1');
        if (!title || !heading) return 0;
        return heading.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
      });

      expect(titleToHeadingGap).toBeGreaterThanOrEqual(sizes.body * 0.75);

      const titleMetrics = await page.evaluate(() => {
        const title = document.querySelector<HTMLTextAreaElement>('[data-note-title-input="true"]');
        if (!title) return null;
        const style = getComputedStyle(title);
        return {
          clientHeight: title.clientHeight,
          scrollHeight: title.scrollHeight,
          paddingTop: Number.parseFloat(style.paddingTop),
          paddingBottom: Number.parseFloat(style.paddingBottom),
        };
      });

      expect(titleMetrics).not.toBeNull();
      expect(titleMetrics!.paddingTop).toBeGreaterThan(0);
      expect(titleMetrics!.paddingBottom).toBeGreaterThan(0);
      expect(titleMetrics!.clientHeight).toBeGreaterThanOrEqual(titleMetrics!.scrollHeight);

      const clippedScaledSurfaces = await page.evaluate(() => {
        const scaledRoots = Array.from(document.querySelectorAll<HTMLElement>(
          '[data-vlaina-markdown-font-size-surface="true"], .markdown-surface, .milkdown .ProseMirror'
        ));
        const candidates = new Set<HTMLElement>();
        for (const root of scaledRoots) {
          candidates.add(root);
          root.querySelectorAll<HTMLElement>('textarea, h1, h2, h3, h4, h5, h6, p, li, blockquote, td, th, [data-hero-icon-title="true"]')
            .forEach((element) => candidates.add(element));
        }

        return Array.from(candidates)
          .map((element) => {
            const style = getComputedStyle(element);
            const clipsY = style.overflowY === 'hidden' || style.overflow === 'hidden';
            const clipsX = style.overflowX === 'hidden' || style.overflow === 'hidden';
            const verticalOverflow = clipsY && element.scrollHeight > element.clientHeight + 1;
            const horizontalOverflow = clipsX && element.scrollWidth > element.clientWidth + 1;
            return {
              tagName: element.tagName,
              className: element.className,
              text: (element instanceof HTMLTextAreaElement ? element.value : element.textContent ?? '').slice(0, 80),
              overflow: style.overflow,
              overflowX: style.overflowX,
              overflowY: style.overflowY,
              clientHeight: element.clientHeight,
              scrollHeight: element.scrollHeight,
              clientWidth: element.clientWidth,
              scrollWidth: element.scrollWidth,
              verticalOverflow,
              horizontalOverflow,
            };
          })
          .filter((item) => item.verticalOverflow || item.horizontalOverflow);
      });

      expect(clippedScaledSurfaces).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
