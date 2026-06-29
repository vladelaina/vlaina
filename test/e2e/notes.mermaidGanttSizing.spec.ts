import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

const GANTT_FIXTURE = [
  '%% Example with selection of syntaxes',
  'gantt',
  'dateFormat  YYYY-MM-DD',
  'title Adding GANTT diagram functionality to mermaid',
  '',
  'section A section',
  'Completed task            :done,    des1, 2014-01-06,2014-01-08',
  'Active task               :active,  des2, 2014-01-09, 3d',
  'Future task               :         des3, after des2, 5d',
  'Future task2               :         des4, after des3, 5d',
  '',
  'section Critical tasks',
  'Completed task in the critical line :crit, done, 2014-01-06,24h',
  'Implement parser and jison          :crit, done, after des1, 2d',
  'Create tests for parser             :crit, active, 3d',
  'Future task in critical line        :crit, 5d',
  'Create tests for renderer           :2d',
  'Add to mermaid                      :1d',
  '',
  'section Documentation',
  'Describe gantt syntax               :active, a1, after des1, 3d',
  'Add gantt diagram to demo page      :after a1  , 20h',
  'Add another diagram to demo page    :doc1, after a1  , 48h',
  '',
  'section Last section',
  'Describe gantt syntax               :after doc1, 3d',
  'Add gantt diagram to demo page      : 20h',
].join('\n');

test.describe('notes Mermaid Gantt sizing', () => {
  test.setTimeout(120_000);

  test('renders the Mermaid Gantt fixture with measurable chart dimensions', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-mermaid-gantt-sizing');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'mermaid-gantt-sizing.md',
        content: [
          '# Mermaid Gantt sizing',
          '',
          '```mermaid',
          GANTT_FIXTURE,
          '```',
        ].join('\n'),
      });

      const block = page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"]`).first();
      await expect(block).toBeVisible({ timeout: 30_000 });
      await expect(block.locator('svg')).toBeVisible({ timeout: 30_000 });

      const metrics = await block.evaluate((element) => {
        const svg = element.querySelector<SVGSVGElement>('svg');
        const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
        const blockRect = element.getBoundingClientRect();
        const svgRect = svg?.getBoundingClientRect();
        const editorRect = editor?.getBoundingClientRect();
        return {
          block: {
            clientWidth: element.clientWidth,
            diagramType: element.dataset.mermaidDiagram ?? null,
            scrollWidth: element.scrollWidth,
            height: Math.round(blockRect.height),
            width: Math.round(blockRect.width),
          },
          editor: editorRect
            ? {
                height: Math.round(editorRect.height),
                width: Math.round(editorRect.width),
              }
            : null,
          svg: svg && svgRect
            ? {
                attrHeight: svg.getAttribute('height'),
                attrWidth: svg.getAttribute('width'),
                attrViewBox: svg.getAttribute('viewBox'),
                className: svg.getAttribute('class'),
                id: svg.id,
                height: Math.round(svgRect.height),
                width: Math.round(svgRect.width),
                textCount: svg.querySelectorAll('text').length,
              }
            : null,
        };
      });
      console.info('[mermaid-gantt-sizing]', JSON.stringify(metrics));
      await test.info().attach('mermaid-gantt-sizing.png', {
        body: await block.screenshot(),
        contentType: 'image/png',
      });

      expect(metrics.svg?.textCount).toBeGreaterThan(10);
      expect(metrics.block.diagramType).toBe('gantt');
      expect(metrics.block.scrollWidth).toBeGreaterThan(metrics.block.clientWidth);
      expect(metrics.svg?.width).toBeGreaterThanOrEqual(1100);
      expect(metrics.svg?.height).toBeGreaterThanOrEqual(400);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
