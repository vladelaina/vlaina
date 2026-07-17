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
    const sourceSegments = createManualInputSegments(manualMarkdown, {
      maxSegments: 30,
      maxTableSegmentLines: 2,
    });
    const isTableSegment = (segment: string) => /^\|.+\|\n\|[- :|]+\|/m.test(segment);
    const isSetextSegment = (segment: string) => /^[^\n]+\n(?:=+|-+)\s*$/.test(segment.trim());
    const isLinewiseBlockSegment = (segment: string) => /^(?:[-+*]\s+|\d+[.)]\s+|>\s+)/.test(segment.trim());
    const isHorizontalRuleSegment = (segment: string) => /^(?:\*\s*){3,}$/.test(segment.trim());
    const isFootnoteDefinitionSegment = (segment: string) => /^\[\^[^\]]+\]:/.test(segment.trim());
    const tableSegment = sourceSegments.find(isTableSegment);
    const nonTableSegments = sourceSegments.filter((segment) => !isTableSegment(segment));
    const segments = [nonTableSegments[0], tableSegment, ...nonTableSegments.slice(1)]
      .filter((segment): segment is string => Boolean(segment));
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
      const expectedTableHeaderTexts: string[] = [];
      const expectedSetextHeadings: Array<{ level: 1 | 2; text: string }> = [];

      for (const [index, segment] of segments.entries()) {
        const startedAt = Date.now();
        const isTable = isTableSegment(segment);
        if (isTable) {
          const [headerLine, delimiterLine] = segment.trim().split(/\r?\n/);
          const firstHeaderCell = headerLine.split('|').map((cell) => cell.trim()).find(Boolean);
          if (firstHeaderCell) expectedTableHeaderTexts.push(firstHeaderCell);
          await page.keyboard.type(headerLine, { delay: 0 });
          await page.keyboard.press('Enter');
          await page.keyboard.type(delimiterLine, { delay: 0 });
          await page.keyboard.press('Enter');
          await page.keyboard.press('Control+Enter');
        } else if (isSetextSegment(segment)) {
          const [headingLine, delimiterLine] = segment.trim().split(/\r?\n/);
          expectedSetextHeadings.push({
            level: delimiterLine.trim().startsWith('=') ? 1 : 2,
            text: headingLine.trim(),
          });
          await page.keyboard.type(headingLine, { delay: 0 });
          await page.keyboard.press('Enter');
          await page.keyboard.type(delimiterLine, { delay: 0 });
          await page.keyboard.press('Enter');
        } else if (isHorizontalRuleSegment(segment)) {
          await page.keyboard.type(segment.trim(), { delay: 0 });
          await page.keyboard.press('Enter');
        } else if (isFootnoteDefinitionSegment(segment)) {
          await page.keyboard.type(segment.trim(), { delay: 0 });
          await page.keyboard.press('Enter');
        } else if (isLinewiseBlockSegment(segment)) {
          const lines = segment.trim().split(/\r?\n/);
          for (const [lineIndex, line] of lines.entries()) {
            await page.keyboard.type(line, { delay: 0 });
            if (lineIndex < lines.length - 1) {
              await page.keyboard.press('Enter');
            }
          }
          await page.keyboard.press('Enter');
          await page.keyboard.press('Enter');
        } else {
          await page.keyboard.type(segment, { delay: 0 });
        }
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        inputMetrics.push({
          index,
          chars: segment.length,
          durationMs: Date.now() - startedAt,
          isTable,
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
      const renderedTableTexts = await page.locator(`${EDITOR_SELECTOR} table`).allTextContents();

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
      expect(domMetrics.countsBySelector.orderedItems).toBeGreaterThan(0);
      expect(domMetrics.countsBySelector.taskItems).toBeGreaterThan(0);
      expect(domMetrics.countsBySelector.blockquotes).toBeGreaterThan(0);
      expect(domMetrics.countsBySelector.horizontalRules).toBeGreaterThan(0);
      expect(domMetrics.countsBySelector.footnoteDefs).toBeGreaterThan(0);
      expect(domMetrics.countsBySelector.tables).toBe(tableInputCount);
      expect(tableInputCount).toBeGreaterThan(0);
      expect(expectedSetextHeadings.length).toBeGreaterThan(0);
      await expect(page.locator(`${EDITOR_SELECTOR} table`).filter({ hasText: '功能' })).toHaveCount(1);
      for (const expectedHeader of expectedTableHeaderTexts) {
        expect(renderedTableTexts.some((text) => text.includes(expectedHeader))).toBe(true);
      }
      for (const heading of expectedSetextHeadings) {
        await expect(page.locator(`${EDITOR_SELECTOR} h${heading.level}`, { hasText: heading.text })).toHaveCount(1);
      }
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
