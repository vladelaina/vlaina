import { expect, test } from '@playwright/test';
import {
  buildMermaidFormatsMarkdown,
  MERMAID_FORMAT_FIXTURES,
} from '../../src/test/fixtures/mermaidFormatFixtures';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

test.describe('notes Mermaid format matrix', () => {
  test.setTimeout(180_000);

  test('renders common Mermaid diagram formats with visible SVG content', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-mermaid-format-matrix');

    try {
      await app.firstWindow({ timeout: 60_000 });
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1440, height: 960 });

      await openMarkdownFixture(page, {
        filename: 'mermaid-format-matrix.md',
        content: buildMermaidFormatsMarkdown(),
      });

      const blocks = page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"]`);
      await expect(blocks).toHaveCount(MERMAID_FORMAT_FIXTURES.length, { timeout: 30_000 });

      const results = [];
      for (const [index, fixture] of MERMAID_FORMAT_FIXTURES.entries()) {
        const block = blocks.nth(index);
        await block.scrollIntoViewIfNeeded();
        await expect(block).toBeVisible({ timeout: 30_000 });

        const readMetrics = () => block.evaluate((element) => {
          const svg = element.querySelector<SVGSVGElement>('svg');
          const error = element.querySelector<HTMLElement>('.mermaid-error');
          const empty = element.querySelector<HTMLElement>('.mermaid-empty');
          const placeholder = element.querySelector<HTMLElement>('.mermaid-placeholder');
          const blockRect = element.getBoundingClientRect();
          const svgRect = svg?.getBoundingClientRect();
          const visibleText = (svg?.textContent ?? '').replace(/\s+/g, ' ').trim();
          return {
            blockHeight: Math.round(blockRect.height),
            blockWidth: Math.round(blockRect.width),
            diagramType: element.dataset.mermaidDiagram ?? null,
            emptyText: empty?.textContent?.trim() ?? '',
            errorText: error?.textContent?.trim() ?? '',
            hasPlaceholder: Boolean(placeholder),
            hasSvg: Boolean(svg),
            shapeCount: svg?.querySelectorAll('path,line,rect,circle,ellipse,polygon,polyline,use,foreignObject').length ?? 0,
            svgHeight: svgRect ? Math.round(svgRect.height) : 0,
            svgWidth: svgRect ? Math.round(svgRect.width) : 0,
            textLength: visibleText.length,
          };
        });
        await expect.poll(async () => {
          const metrics = await readMetrics();
          if (metrics.hasSvg) return 'svg';
          if (metrics.errorText) return 'error';
          if (metrics.emptyText) return 'empty';
          if (metrics.hasPlaceholder) return 'pending';
          return 'blank';
        }, {
          message: `${fixture.label} should finish Mermaid rendering`,
          timeout: 30_000,
        }).not.toBe('pending');
        const metrics = await readMetrics();
        results.push({ label: fixture.label, ...metrics });

        expect(metrics.hasSvg, `${fixture.label} should render an SVG: ${JSON.stringify(metrics)}`).toBe(true);
        expect(metrics.errorText, `${fixture.label} rendered an error`).toBe('');
        expect(metrics.svgWidth, `${fixture.label} svg width`).toBeGreaterThanOrEqual(fixture.minWidth ?? 80);
        expect(metrics.svgHeight, `${fixture.label} svg height`).toBeGreaterThanOrEqual(fixture.minHeight ?? 32);
        expect(
          metrics.textLength + metrics.shapeCount,
          `${fixture.label} should contain visible SVG content`
        ).toBeGreaterThan(0);
      }

      console.info('[mermaid-format-matrix]', JSON.stringify(results));
      await test.info().attach('mermaid-format-matrix.json', {
        body: JSON.stringify(results, null, 2),
        contentType: 'application/json',
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
