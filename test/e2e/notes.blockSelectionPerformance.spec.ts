import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

function createBlockSelectionPerformanceMarkdown(blockCount: number): string {
  const blocks = ['# Block Selection Performance', ''];

  for (let index = 0; index < blockCount; index += 1) {
    blocks.push(
      [
        `Performance block ${index} sentinel paragraph.`,
        'This paragraph is intentionally plain so the test measures block selection scaling.',
        'Repeated ordinary blocks catch regressions where decoration or overlay work grows with every selected block.',
      ].join(' '),
      '',
    );
  }

  return blocks.join('\n');
}

function createHardBreakBlockSelectionPerformanceMarkdown(blockCount: number): string {
  const blocks = ['# Block Selection Hard Break Performance', ''];

  for (let index = 0; index < blockCount; index += 1) {
    blocks.push(
      [
        `Performance hard break block ${index} first visual line.\\`,
        'Second visual line keeps the paragraph in one selectable block.\\',
        'Third visual line triggers line-fill overlay measurement.',
      ].join('\n'),
      '',
    );
  }

  return blocks.join('\n');
}

test.describe('notes block selection performance', () => {
  test.setTimeout(120_000);

  test('keeps growing block selections responsive in large notes', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection-performance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'block-selection-performance.md',
        content: createBlockSelectionPerformanceMarkdown(700),
      });

      await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Performance block 0 sentinel' })).toBeVisible();

      const metrics = await page.evaluate(async () =>
        (window as any).__vlainaE2E.measureGrowingBlockSelectionByIndexCounts([
          1,
          25,
          100,
          250,
          500,
          700,
        ]));

      console.info('[notes-block-selection-growing-performance]', metrics);

      expect(metrics.selectableCount).toBeGreaterThanOrEqual(700);
      expect(metrics.results).toHaveLength(6);
      for (const result of metrics.results) {
        expect(result.selectedStateCount).toBe(result.requestedCount);
        expect(result.selectedDomCount).toBe(result.requestedCount);
      }

      const largestSelection = metrics.results.at(-1);
      expect(largestSelection?.dispatchMs ?? Number.POSITIVE_INFINITY).toBeLessThan(80);
      expect(largestSelection?.totalMs ?? Number.POSITIVE_INFINITY).toBeLessThan(140);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps growing block selections responsive with hard-break paragraphs', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection-hard-break-performance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      await openMarkdownFixture(page, {
        filename: 'block-selection-hard-break-performance.md',
        content: createHardBreakBlockSelectionPerformanceMarkdown(520),
      });

      await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();
      await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Performance hard break block 0' })).toBeVisible();

      const metrics = await page.evaluate(async () =>
        (window as any).__vlainaE2E.measureGrowingBlockSelectionByIndexCounts([
          1,
          25,
          100,
          250,
          500,
        ]));

      console.info('[notes-block-selection-hard-break-growing-performance]', metrics);

      expect(metrics.selectableCount).toBeGreaterThanOrEqual(520);
      expect(metrics.results).toHaveLength(5);
      for (const result of metrics.results) {
        expect(result.selectedStateCount).toBe(result.requestedCount);
        expect(result.selectedDomCount).toBe(result.requestedCount);
      }

      const largestSelection = metrics.results.at(-1);
      expect(largestSelection?.lineFillCount ?? 0).toBeGreaterThan(0);
      expect(largestSelection?.dispatchMs ?? Number.POSITIVE_INFINITY).toBeLessThan(120);
      expect(largestSelection?.totalMs ?? Number.POSITIVE_INFINITY).toBeLessThan(220);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
