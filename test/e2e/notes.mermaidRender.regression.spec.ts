import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openAbsoluteNote,
  openMarkdownFixture,
} from './notesE2E';

const QUADRANT_CHART_FIXTURE = [
  'quadrantChart',
  '    title Reach and engagement of campaigns',
  '    x-axis Low Reach --> High Reach',
  '    y-axis Low Engagement --> High Engagement',
  '    quadrant-1 We should expand',
  '    quadrant-2 Need to promote',
  '    quadrant-3 Re-evaluate',
  '    quadrant-4 May be improved',
  '    Campaign A: [0.3, 0.6]',
  '    Campaign B: [0.45, 0.23]',
  '    Campaign C: [0.57, 0.69]',
  '    Campaign F: [0.35, 0.78]',
].join('\n');

test.describe('notes mermaid render regressions', () => {
  test.setTimeout(120_000);

  test('cancels temporary diagrams and persists normalized edits after reopening', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-mermaid-editor-lifecycle');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'mermaid-cancel-new.md',
        content: '',
      });
      await page.locator(EDITOR_SELECTOR).click({ position: { x: 24, y: 24 } });
      await page.keyboard.type('```mermaid');
      await page.keyboard.press('Enter');

      const popup = page.locator('.mermaid-editor-popup');
      const textarea = popup.locator('textarea.text-editor-textarea');
      await expect(textarea).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"]`)).toHaveCount(1);
      await textarea.fill('graph TD\nDraft --> Cancelled');
      await textarea.press('Escape');

      await expect(popup).toHaveCount(0);
      await expect(page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"]`)).toHaveCount(0);
      await expect.poll(() => page.evaluate(() =>
        document.activeElement?.closest('.ProseMirror') !== null
      )).toBe(true);

      const originalCode = 'graph TD\nA --> B';
      const opened = await openMarkdownFixture(page, {
        filename: 'mermaid-edit-lifecycle.md',
        content: [
          'Paragraph before Mermaid.',
          '',
          '```mermaid',
          originalCode,
          '```',
          '',
          'Paragraph after Mermaid.',
        ].join('\n'),
      });
      const originalContent = await page.evaluate(() =>
        String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
      );
      const block = page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"]`).first();
      await expect(block.locator('svg')).toBeVisible({ timeout: 30_000 });

      await block.click({ position: { x: 40, y: 40 } });
      await expect(textarea).toHaveValue(originalCode, { timeout: 10_000 });
      await textarea.fill('not a diagram');
      await expect(block.locator('.mermaid-error')).toBeVisible({ timeout: 30_000 });
      const invalidPreviewState = await page.evaluate(() => ({
        bodyText: document.body.textContent ?? '',
        temporaryMermaidHostCount: document.querySelectorAll(
          '[data-mermaid-render-host="true"], [id^="dmermaid-"], [id^="imermaid-"]'
        ).length,
      }));
      expect(invalidPreviewState.bodyText).not.toContain('Syntax error in text');
      expect(invalidPreviewState.temporaryMermaidHostCount).toBe(0);
      await textarea.press('Escape');

      await expect(popup).toHaveCount(0);
      await expect(block.locator('svg')).toBeVisible({ timeout: 30_000 });
      await expect(block.locator('.mermaid-error')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() =>
        String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
      )).toBe(originalContent);

      const normalizedCode = [
        'sequenceDiagram',
        'Alice->>Bob: Saved after edit',
        'Bob-->>Alice: Reopened successfully',
      ].join('\n');
      await block.click({ position: { x: 40, y: 40 } });
      await expect(textarea).toHaveValue(originalCode, { timeout: 10_000 });
      await textarea.fill(['```sequence', normalizedCode.slice('sequenceDiagram\n'.length), '```'].join('\n'));
      await textarea.press('Control+Enter');

      await expect(popup).toHaveCount(0);
      await expect(block.locator('svg')).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => page.evaluate(() =>
        String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
      )).toContain(normalizedCode);
      const editedContent = await page.evaluate(() =>
        String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
      );
      expect(editedContent).not.toContain('```sequence');

      await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
      const savedContent = await page.evaluate((notePath) =>
        (window as any).__vlainaE2E.readTextFile(notePath), opened.notePath
      );
      expect(savedContent).toBe(editedContent);

      await openAbsoluteNote(page, opened.notePath);
      await expect(page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"] svg`)).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => page.evaluate(() =>
        String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
      )).toBe(savedContent);
      await page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"]`).first()
        .click({ position: { x: 40, y: 40 } });
      await expect(textarea).toHaveValue(normalizedCode, { timeout: 10_000 });
      await textarea.press('Escape');
      await expect(popup).toHaveCount(0);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

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

  test('does not clip quadrant chart title or axis labels', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-mermaid-quadrant-chart-labels');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'mermaid-quadrant-chart-labels.md',
        content: [
          '# Mermaid quadrant chart labels',
          '',
          '```mermaid',
          QUADRANT_CHART_FIXTURE,
          '```',
        ].join('\n'),
      });

      const block = page.locator(`${EDITOR_SELECTOR} [data-type="mermaid"]`).first();
      await expect(block).toBeVisible({ timeout: 30_000 });
      await expect(block.locator('svg')).toBeVisible({ timeout: 30_000 });

      const metrics = await block.evaluate((element) => {
        const svg = element.querySelector<SVGSVGElement>('svg');
        if (!svg) {
          return {
            block: null,
            labelsOutsideBlock: [],
            labelsOutsideSvgViewport: [],
            svg: null,
            textLabels: [],
            topBorder: null,
            topQuadrantLabels: [],
            topQuadrantLabelsOverlappingTopBorder: [],
          };
        }

        const blockRect = element.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const textLabels = Array.from(svg.querySelectorAll<SVGTextElement>('text'))
          .map((text) => {
            const rect = text.getBoundingClientRect();
            const label = (text.textContent ?? '').replace(/\s+/g, ' ').trim();
            return {
              label,
              left: Math.round((rect.left - svgRect.left) * 10) / 10,
              right: Math.round((rect.right - svgRect.right) * 10) / 10,
              top: Math.round((rect.top - svgRect.top) * 10) / 10,
              bottom: Math.round((rect.bottom - svgRect.bottom) * 10) / 10,
              outsideSvgLeft: rect.left < svgRect.left - 0.5,
              outsideSvgRight: rect.right > svgRect.right + 0.5,
              outsideSvgTop: rect.top < svgRect.top - 0.5,
              outsideSvgBottom: rect.bottom > svgRect.bottom + 0.5,
              outsideBlockLeft: rect.left < blockRect.left - 0.5,
              outsideBlockRight: rect.right > blockRect.right + 0.5,
              outsideBlockTop: rect.top < blockRect.top - 0.5,
              outsideBlockBottom: rect.bottom > blockRect.bottom + 0.5,
            };
          })
          .filter((entry) => entry.label);
        const labelsOutsideSvgViewport = textLabels.filter((entry) =>
          entry.outsideSvgLeft ||
          entry.outsideSvgRight ||
          entry.outsideSvgTop ||
          entry.outsideSvgBottom
        );
        const labelsOutsideBlock = textLabels.filter((entry) =>
          entry.outsideBlockLeft ||
          entry.outsideBlockRight ||
          entry.outsideBlockTop ||
          entry.outsideBlockBottom
        );
        const horizontalLines = Array.from(svg.querySelectorAll<SVGLineElement>('line'))
          .map((line) => {
            const rect = line.getBoundingClientRect();
            return {
              left: Math.round((rect.left - svgRect.left) * 10) / 10,
              right: Math.round((rect.right - svgRect.left) * 10) / 10,
              top: Math.round((rect.top - svgRect.top) * 10) / 10,
              bottom: Math.round((rect.bottom - svgRect.top) * 10) / 10,
              width: Math.round(rect.width * 10) / 10,
            };
          })
          .filter((entry) => entry.width > svgRect.width * 0.5)
          .sort((left, right) => left.top - right.top);
        const topBorder = horizontalLines[0] ?? null;
        const topQuadrantLabels = textLabels.filter((entry) =>
          entry.label === 'Need to promote' || entry.label === 'We should expand'
        );
        const topQuadrantLabelsOverlappingTopBorder = topBorder
          ? topQuadrantLabels.filter((entry) =>
            entry.top < topBorder.bottom - 0.5 &&
            entry.bottom > topBorder.top + 0.5
          )
          : [];

        return {
          block: {
            height: Math.round(blockRect.height),
            scrollHeight: element.scrollHeight,
            scrollWidth: element.scrollWidth,
            width: Math.round(blockRect.width),
          },
          labelsOutsideBlock,
          labelsOutsideSvgViewport,
          svg: {
            className: svg.getAttribute('class'),
            height: Math.round(svgRect.height),
            overflow: getComputedStyle(svg).overflow,
            viewBox: svg.getAttribute('viewBox'),
            width: Math.round(svgRect.width),
          },
          textLabels,
          topBorder,
          topQuadrantLabels,
          topQuadrantLabelsOverlappingTopBorder,
        };
      });

      console.info('[mermaid-quadrant-chart-labels]', JSON.stringify(metrics));
      await test.info().attach('mermaid-quadrant-chart-labels.png', {
        body: await block.screenshot(),
        contentType: 'image/png',
      });

      expect(metrics.svg, JSON.stringify(metrics, null, 2)).not.toBeNull();
      expect(metrics.textLabels.map((entry) => entry.label)).toEqual(
        expect.arrayContaining([
          'Reach and engagement of campaigns',
          'Low Engagement',
          'High Engagement',
        ])
      );
      expect(metrics.svg?.overflow, JSON.stringify(metrics, null, 2)).toBe('visible');
      expect(metrics.labelsOutsideBlock, JSON.stringify(metrics, null, 2)).toEqual([]);
      expect(metrics.topQuadrantLabels.map((entry) => entry.label)).toEqual(
        expect.arrayContaining(['Need to promote', 'We should expand'])
      );
      expect(metrics.topQuadrantLabelsOverlappingTopBorder, JSON.stringify(metrics, null, 2)).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
