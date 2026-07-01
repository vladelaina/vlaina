import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
  selectNoteBlocksByIndexes,
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

type BlueClip = {
  height: number;
  label: string;
  left: number;
  top: number;
  width: number;
};

async function measureBlueSelectionPixels(page: Page, clip: BlueClip) {
  const viewport = page.viewportSize();
  expect(viewport, `viewport for ${clip.label}`).not.toBeNull();
  const left = Math.max(0, Math.min(clip.left, viewport!.width - 1));
  const top = Math.max(0, Math.min(clip.top, viewport!.height - 1));
  const width = Math.max(1, Math.min(clip.width, viewport!.width - left));
  const height = Math.max(1, Math.min(clip.height, viewport!.height - top));
  const screenshot = await page.screenshot({
    clip: { height, width, x: left, y: top },
    type: 'png',
  });

  return page.evaluate(async ({ imageUrl, label }) => {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Failed to load ${label}`));
      image.src = imageUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error(`Could not sample ${label}`);
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    let blueSelection = 0;
    const total = imageData.width * imageData.height;
    for (let offset = 0; offset < imageData.data.length; offset += 4) {
      const red = imageData.data[offset] ?? 0;
      const green = imageData.data[offset + 1] ?? 0;
      const blue = imageData.data[offset + 2] ?? 0;
      if (red >= 175 && red <= 205 && green >= 210 && green <= 235 && blue >= 240) {
        blueSelection += 1;
      }
    }
    return {
      blueSelectionRatio: blueSelection / total,
      height: imageData.height,
      label,
      width: imageData.width,
    };
  }, {
    imageUrl: `data:image/png;base64,${screenshot.toString('base64')}`,
    label: clip.label,
  });
}

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

  test('keeps the Mermaid horizontal scroll container after block selection', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-mermaid-selection-scroll');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'mermaid-selection-scroll.md',
        content: [
          '# Mermaid selection scroll',
          '',
          '```mermaid',
          GANTT_FIXTURE,
          '```',
        ].join('\n'),
      });

      const block = page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"]`).first();
      await expect(block).toBeVisible({ timeout: 30_000 });
      await expect(block.locator('svg')).toBeVisible({ timeout: 30_000 });

      const before = await block.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          className: element.className,
          clientWidth: element.clientWidth,
          overflowX: style.overflowX,
          scrollWidth: element.scrollWidth,
        };
      });
      expect(before.scrollWidth, JSON.stringify(before, null, 2)).toBeGreaterThan(before.clientWidth);
      expect(before.overflowX, JSON.stringify(before, null, 2)).toBe('auto');

      const mermaidBlockIndex = await page.evaluate(() => {
        const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks() as Array<{
          tagName: string;
          text: string;
        }>;
        return blocks.findIndex((candidate) => (
          candidate.text.includes('Adding GANTT diagram functionality to mermaid')
        ));
      });
      expect(mermaidBlockIndex).toBeGreaterThanOrEqual(0);

      const selectedCount = await selectNoteBlocksByIndexes(page, [mermaidBlockIndex]);
      expect(selectedCount).toBe(1);

      const after = await block.evaluate(async (element) => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
          className: element.className,
          clientWidth: element.clientWidth,
          isSelected: element.classList.contains('editor-block-selected'),
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          scrollWidth: element.scrollWidth,
        };
      });
      console.info('[mermaid-selection-scroll]', JSON.stringify({ before, after }));

      expect(after.isSelected, JSON.stringify(after, null, 2)).toBe(true);
      expect(after.scrollWidth, JSON.stringify(after, null, 2)).toBeGreaterThan(after.clientWidth);
      expect(after.overflowX, JSON.stringify(after, null, 2)).toBe('auto');
      expect(after.overflowY, JSON.stringify(after, null, 2)).toBe('auto');
      expect(after.backgroundColor, JSON.stringify(after, null, 2)).not.toBe('rgba(0, 0, 0, 0)');
      expect(after.boxShadow, JSON.stringify(after, null, 2)).not.toBe('none');
      await expect(page.locator('.mermaid-editor-popup')).toHaveCount(0);

      const scrollbarPoint = await block.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left + Math.min(rect.width - 24, 80),
          y: rect.bottom - 6,
        };
      });
      const scrollbarHitDebug = await block.evaluate((element, point) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const measuredScrollbarHeight = element.offsetHeight - element.clientHeight;
        const scrollbarHitArea = Math.max(measuredScrollbarHeight, 18);
        return {
          clientWidth: element.clientWidth,
          measuredScrollbarHeight,
          overflowX: style.overflowX,
          point,
          rect: {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
          },
          scrollWidth: element.scrollWidth,
          shouldHit:
            (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
            element.scrollWidth > element.clientWidth &&
            point.x >= rect.left &&
            point.x <= rect.right &&
            point.y >= rect.bottom - scrollbarHitArea &&
            point.y <= rect.bottom,
        };
      }, scrollbarPoint);
      expect(scrollbarHitDebug.shouldHit, JSON.stringify(scrollbarHitDebug, null, 2)).toBe(true);
      await page.mouse.move(scrollbarPoint.x, scrollbarPoint.y);
      await page.mouse.down();
      await page.mouse.move(scrollbarPoint.x + 160, scrollbarPoint.y, { steps: 5 });
      await page.mouse.up();
      await expect(page.locator('.mermaid-editor-popup')).toHaveCount(0);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps the selected Gantt surface continuous after selecting adjacent rich blocks', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-mermaid-gantt-adjacent-selection-surface');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 900 });

      await openMarkdownFixture(page, {
        filename: 'mermaid-gantt-adjacent-selection-surface.md',
        content: [
          '```mermaid',
          'graph LR',
          '  A[[Subroutine]] --> B(((Double Circle)))',
          '  B --> C{{Hen}}',
          '```',
          '',
          '$$',
          'dfdsfsdfsdf',
          '$$',
          '',
          '```mermaid',
          GANTT_FIXTURE,
          '```',
        ].join('\n'),
      });

      await expect(page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"]`, { hasText: 'Subroutine' })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(`${EDITOR_SELECTOR} [data-type="math-block"]`)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"][data-mermaid-diagram="gantt"] svg`)).toBeVisible({ timeout: 30_000 });

      const indexes = await page.evaluate(() => {
        const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks() as Array<{
          className: string;
          rangeText: string;
          text: string;
        }>;
        const includesText = (block: { rangeText: string; text: string }, text: string) =>
          block.text.includes(text) || block.rangeText.includes(text);
        return {
          flowchartIndex: blocks.findIndex((block) => includesText(block, 'Subroutine')),
          ganttIndex: blocks.findIndex((block) => includesText(block, 'Adding GANTT diagram functionality to mermaid')),
          mathIndex: blocks.findIndex((block) => includesText(block, 'dfdsfsdfsdf')),
          blocks: blocks.map((block, index) => ({
            className: block.className,
            index,
            rangeText: block.rangeText,
            text: block.text,
          })),
        };
      });
      expect(indexes.flowchartIndex, JSON.stringify(indexes, null, 2)).toBeGreaterThanOrEqual(0);
      expect(indexes.mathIndex, JSON.stringify(indexes, null, 2)).toBeGreaterThanOrEqual(0);
      expect(indexes.ganttIndex, JSON.stringify(indexes, null, 2)).toBeGreaterThanOrEqual(0);

      const selectedIndexes = Array.from(
        { length: indexes.ganttIndex - indexes.flowchartIndex + 1 },
        (_, index) => indexes.flowchartIndex + index,
      );
      const selectedCount = await selectNoteBlocksByIndexes(page, selectedIndexes);
      expect(selectedCount, JSON.stringify({ indexes, selectedIndexes }, null, 2)).toBe(selectedIndexes.length);

      const metrics = await page.evaluate(async (editorSelector) => {
        const math = document.querySelector<HTMLElement>(`${editorSelector} [data-type="math-block"].editor-block-selected`);
        const gantt = document.querySelector<HTMLElement>(`${editorSelector} [data-type="mermaid"][data-mermaid-diagram="gantt"].editor-block-selected`);
        if (!math || !gantt) return null;
        gantt.scrollIntoView({ block: 'center', inline: 'nearest' });
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const mathRect = math.getBoundingClientRect();
        const ganttRect = gantt.getBoundingClientRect();
        const ganttStyle = getComputedStyle(gantt);
        return {
          gantt: {
            backgroundColor: ganttStyle.backgroundColor,
            boxShadow: ganttStyle.boxShadow,
            className: gantt.className,
            clientWidth: gantt.clientWidth,
            overflowX: ganttStyle.overflowX,
            overflowY: ganttStyle.overflowY,
            rect: {
              bottom: ganttRect.bottom,
              left: ganttRect.left,
              right: ganttRect.right,
              top: ganttRect.top,
            },
            scrollWidth: gantt.scrollWidth,
          },
          math: {
            rect: {
              bottom: mathRect.bottom,
              left: mathRect.left,
              right: mathRect.right,
              top: mathRect.top,
            },
          },
        };
      }, EDITOR_SELECTOR);
      expect(metrics, 'selected adjacent mermaid/math metrics').not.toBeNull();
      expect(metrics!.gantt.className, JSON.stringify(metrics, null, 2)).toContain('editor-block-selected-has-previous');
      expect(metrics!.gantt.backgroundColor, JSON.stringify(metrics, null, 2)).not.toBe('rgba(0, 0, 0, 0)');
      expect(metrics!.gantt.boxShadow, JSON.stringify(metrics, null, 2)).not.toBe('none');
      expect(metrics!.gantt.overflowX, JSON.stringify(metrics, null, 2)).toBe('auto');
      expect(metrics!.gantt.scrollWidth, JSON.stringify(metrics, null, 2)).toBeGreaterThan(metrics!.gantt.clientWidth);

      const gapTop = metrics!.math.rect.bottom;
      const gapHeight = metrics!.gantt.rect.top - metrics!.math.rect.bottom;
      expect(gapHeight, JSON.stringify(metrics, null, 2)).toBeGreaterThan(1);
      const leftBleed = await measureBlueSelectionPixels(page, {
        height: 24,
        label: 'selected gantt left bleed',
        left: metrics!.gantt.rect.left - 36,
        top: metrics!.gantt.rect.top + 28,
        width: 24,
      });
      const topGap = await measureBlueSelectionPixels(page, {
        height: Math.max(2, Math.min(12, gapHeight)),
        label: 'selected math to gantt gap',
        left: metrics!.gantt.rect.left + 24,
        top: gapTop,
        width: 160,
      });
      const bottomInside = await measureBlueSelectionPixels(page, {
        height: 8,
        label: 'selected gantt bottom inside',
        left: metrics!.gantt.rect.left + 24,
        top: metrics!.gantt.rect.bottom - 14,
        width: 160,
      });

      expect(leftBleed.blueSelectionRatio, JSON.stringify({ leftBleed, metrics }, null, 2)).toBeGreaterThan(0.35);
      expect(topGap.blueSelectionRatio, JSON.stringify({ topGap, metrics }, null, 2)).toBeGreaterThan(0.35);
      expect(bottomInside.blueSelectionRatio, JSON.stringify({ bottomInside, metrics }, null, 2)).toBeGreaterThan(0.35);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps Mermaid pie text dark after block selection', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-mermaid-pie-selection-text');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'mermaid-pie-selection-text.md',
        content: [
          '# Mermaid pie selection text',
          '',
          '```mermaid',
          'pie',
          '    title Pie Chart',
          '    "Dogs" : 386',
          '    "Cats" : 85',
          '    "Rats" : 150',
          '```',
        ].join('\n'),
      });

      const block = page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"]`).first();
      await expect(block).toBeVisible({ timeout: 30_000 });
      await expect(block.locator('svg')).toBeVisible({ timeout: 30_000 });

      const mermaidBlockIndex = await page.evaluate(() => {
        const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks() as Array<{
          tagName: string;
          text: string;
        }>;
        return blocks.findIndex((candidate) => candidate.text.includes('Pie Chart'));
      });
      expect(mermaidBlockIndex).toBeGreaterThanOrEqual(0);

      const selectedCount = await selectNoteBlocksByIndexes(page, [mermaidBlockIndex]);
      expect(selectedCount).toBe(1);

      const textMetrics = await block.evaluate(async (element) => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const probe = document.createElement('span');
        probe.style.color = 'var(--vlaina-mermaid-text)';
        document.body.appendChild(probe);
        const expectedMermaidText = getComputedStyle(probe).color;
        probe.remove();

        const textNodes = Array.from(element.querySelectorAll<SVGElement>('svg text, svg tspan'))
          .filter((node) => (node.textContent ?? '').trim().length > 0);
        const texts = textNodes.map((node) => {
          const style = getComputedStyle(node);
          return {
            color: style.color,
            fill: style.fill,
            text: (node.textContent ?? '').trim(),
            textFillColor: style.webkitTextFillColor,
          };
        });
        const isWhite = (value: string) => value === 'rgb(255, 255, 255)' || value === '#fff' || value === '#ffffff';
        return {
          className: element.className,
          expectedMermaidText,
          isSelected: element.classList.contains('editor-block-selected'),
          textCount: texts.length,
          texts,
          mismatchedColorCount: texts.filter((entry) => entry.color !== expectedMermaidText).length,
          mismatchedFillCount: texts.filter((entry) => entry.fill !== expectedMermaidText).length,
          mismatchedTextFillCount: texts.filter((entry) => entry.textFillColor !== expectedMermaidText).length,
          whiteFillCount: texts.filter((entry) => isWhite(entry.fill)).length,
        };
      });
      console.info('[mermaid-pie-selection-text]', JSON.stringify(textMetrics));

      expect(textMetrics.isSelected, JSON.stringify(textMetrics, null, 2)).toBe(true);
      expect(textMetrics.textCount, JSON.stringify(textMetrics, null, 2)).toBeGreaterThan(0);
      expect(textMetrics.mismatchedColorCount, JSON.stringify(textMetrics, null, 2)).toBe(0);
      expect(textMetrics.whiteFillCount, JSON.stringify(textMetrics, null, 2)).toBe(0);
      expect(textMetrics.mismatchedFillCount, JSON.stringify(textMetrics, null, 2)).toBe(0);
      expect(textMetrics.mismatchedTextFillCount, JSON.stringify(textMetrics, null, 2)).toBe(0);

      const selectedOverflow = await block.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          overflowX: style.overflowX,
          overflowY: style.overflowY,
        };
      });
      expect(selectedOverflow.overflowX, JSON.stringify(selectedOverflow, null, 2)).toBe('visible');
      expect(selectedOverflow.overflowY, JSON.stringify(selectedOverflow, null, 2)).toBe('visible');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
