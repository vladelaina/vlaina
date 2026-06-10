import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  collectEditorDomMetrics,
  getOpenBridgePages,
  launchIsolatedElectron,
  measureRepeatedBlockScan,
  openMarkdownFixture,
} from './notesE2E';
import {
  MANUAL_MARKDOWN_PATH,
  createManualInputSegments,
} from './notesManualSegments';

test.describe('notes manual markdown input performance', () => {
  test.setTimeout(180_000);

  test('types representative manual markdown syntax segments without input stalls', async () => {
    const manualMarkdown = await fs.readFile(MANUAL_MARKDOWN_PATH, 'utf8');
    const segments = createManualInputSegments(manualMarkdown);
    expect(segments.length).toBeGreaterThan(10);

    const { app, userDataRoot } = await launchIsolatedElectron('notes-manual-input-performance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:')) {
          console.info(text);
        }
      });

      await openMarkdownFixture(page, {
        filename: 'manual-input-performance-e2e.md',
        content: '',
      });

      await page.locator(EDITOR_SELECTOR).click();
      const inputMetrics: Array<{
        index: number;
        chars: number;
        durationMs: number;
        isTable: boolean;
        textStart: string;
      }> = [];

      for (const [index, segment] of segments.entries()) {
        const startedAt = Date.now();
        await page.keyboard.type(segment, { delay: 0 });
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        inputMetrics.push({
          index,
          chars: segment.length,
          durationMs: Date.now() - startedAt,
          isTable: /^\|.+\|\n\|[- :|]+\|/m.test(segment),
          textStart: segment.trim().slice(0, 80),
        });
      }

      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Markdown 编辑器测试手册');

      const domMetrics = await collectEditorDomMetrics(page);
      const blockScanMetrics = await measureRepeatedBlockScan(page, 10);
      const slowestSegments = [...inputMetrics]
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 8);
      const totalInputMs = inputMetrics.reduce((sum, metric) => sum + metric.durationMs, 0);
      const maxInputMs = Math.max(...inputMetrics.map((metric) => metric.durationMs));
      const maxNonTableInputMs = Math.max(
        ...inputMetrics
          .filter((metric) => !metric.isTable)
          .map((metric) => metric.durationMs),
      );
      const tableInputCount = inputMetrics.filter((metric) => metric.isTable).length;

      console.info('[notes-manual-input-performance]', {
        segmentCount: segments.length,
        totalChars: segments.reduce((sum, segment) => sum + segment.length, 0),
        totalInputMs,
        maxInputMs,
        maxNonTableInputMs,
        slowestSegments,
        domMetrics,
        blockScanMetrics,
      });

      expect(domMetrics.countsBySelector.sourceFallback).toBe(0);
      expect(domMetrics.countsBySelector.headings).toBeGreaterThan(0);
      expect(domMetrics.countsBySelector.codeBlocks).toBeGreaterThan(0);
      expect(domMetrics.countsBySelector.bulletItems).toBeGreaterThan(0);
      expect(tableInputCount).toBeGreaterThan(0);
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('| 功能');
      expect(domMetrics.renderedBlockCount).toBeGreaterThan(12);
      expect(domMetrics.editorTextLength).toBeGreaterThan(700);
      expect(blockScanMetrics.p95Ms).toBeLessThan(250);
      expect(maxInputMs).toBeLessThan(12_000);
      expect(maxNonTableInputMs).toBeLessThan(8_000);
      expect(totalInputMs).toBeLessThan(70_000);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
