import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  collectEditorDomMetrics,
  getOpenBridgePages,
  launchIsolatedElectron,
  measureRepeatedBlockScan,
  measureScrollFrames,
  openMarkdownFixture,
  selectNoteBlocksByText,
  waitForStableSelectableBlockCount,
} from './notesE2E';

function createSyntaxSection(index: number): string {
  return [
    `## Syntax Perf Section ${index}`,
    '',
    `Paragraph ${index} contains **bold ${index}**, *italic ${index}*, ==highlight ${index}==, \`inline-${index}\`, [link ${index}](https://example.com/${index}), www.example${index}.org, #perf-tag-${index}, and enough prose to wrap across several visual lines in the editor surface.`,
    '',
    `> Quote ${index} first line.`,
    `> Quote ${index} second line.`,
    '',
    `> 💡 Callout ${index} body sentinel.`,
    `> Callout ${index} second line.`,
    '',
    `- Bullet ${index} alpha`,
    `- Bullet ${index} beta`,
    `  - Nested bullet ${index} child`,
    '',
    `1. Ordered ${index} alpha`,
    `2. Ordered ${index} beta`,
    '',
    `- [ ] Task ${index} unchecked`,
    `- [x] Task ${index} checked`,
    '',
    `Term ${index}`,
    `: Definition ${index} description`,
    '',
    '| Key | Value |',
    '| --- | --- |',
    `| Row ${index} | Value ${index} |`,
    '',
    '```ts',
    `const perfSyntax${index} = ${index};`,
    '```',
    '',
    `Inline math ${index}: $x_${index}^2 + y_${index}^2$.`,
    '',
  ].join('\n');
}

function createLargeSyntaxMarkdown(sectionCount: number): string {
  const sections = [
    '---',
    'title: E2E Syntax Performance',
    'tags:',
    '  - e2e',
    '  - performance',
    '---',
    '',
    '# E2E Syntax Performance',
    '',
    '[TOC]',
    '',
  ];
  for (let index = 0; index < sectionCount; index += 1) {
    sections.push(createSyntaxSection(index));
  }
  sections.push('Final syntax performance sentinel.');
  return sections.join('\n');
}

test.describe('notes markdown syntax performance smoke', () => {
  test.setTimeout(150_000);

  test('opens, scrolls, scans, and selects blocks in a large mixed-syntax markdown note', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-markdown-syntax-performance');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:')) {
          console.info(text);
        }
      });

      const content = createLargeSyntaxMarkdown(80);
      const opened = await openMarkdownFixture(page, {
        filename: 'markdown-syntax-performance-e2e.md',
        content,
      });
      await expect(page.locator(EDITOR_SELECTOR)).toContainText('Final syntax performance sentinel');

      const stableSelectableBlockCount = await waitForStableSelectableBlockCount(page, {
        timeoutMs: 10_000,
      });
      const domMetrics = await collectEditorDomMetrics(page);
      const scrollMetrics = await measureScrollFrames(page, 45);
      const blockScanMetrics = await measureRepeatedBlockScan(page, 20);

      const selectedStartedAt = Date.now();
      const selectedCount = await selectNoteBlocksByText(page, [
        'E2E Syntax Performance',
        'Paragraph 0 contains',
        'Task 10 checked',
        'Definition 20 description',
        'Paragraph 40 contains',
        'Task 60 checked',
        'Final syntax performance sentinel',
      ]);
      const selectedWallMs = Date.now() - selectedStartedAt;
      await expect(page.locator(SELECTED_BLOCK_SELECTOR).first()).toBeVisible();

      const selectedScrollMetrics = await measureScrollFrames(page, 45);

      console.info('[notes-markdown-syntax-performance]', {
        sourceLength: content.length,
        opened,
        stableSelectableBlockCount,
        domMetrics,
        scrollMetrics,
        blockScanMetrics,
        selectedCount,
        selectedWallMs,
        selectedScrollMetrics,
      });

      expect(domMetrics.countsBySelector.sourceFallback).toBe(0);
      expect(domMetrics.countsBySelector.headings).toBeGreaterThanOrEqual(80);
      expect(domMetrics.countsBySelector.callouts).toBeGreaterThanOrEqual(80);
      expect(domMetrics.countsBySelector.taskItems).toBeGreaterThanOrEqual(160);
      expect(domMetrics.countsBySelector.tables).toBeGreaterThanOrEqual(80);
      expect(domMetrics.countsBySelector.codeBlocks).toBeGreaterThanOrEqual(80);
      expect(domMetrics.countsBySelector.toc).toBeGreaterThanOrEqual(1);
      expect(domMetrics.selectableBlockCount).toBeGreaterThan(700);
      expect(domMetrics.selectableBlockCount).toBe(stableSelectableBlockCount);
      expect(blockScanMetrics.blockCount).toBe(stableSelectableBlockCount);
      expect(blockScanMetrics.p95Ms).toBeLessThan(250);
      expect(selectedCount).toBeGreaterThanOrEqual(7);
      expect(selectedWallMs).toBeLessThan(5_000);
      expect(scrollMetrics).not.toBeNull();
      expect(selectedScrollMetrics).not.toBeNull();
      expect(scrollMetrics!.maxFrameMs).toBeLessThan(1_500);
      expect(selectedScrollMetrics!.maxFrameMs).toBeLessThan(1_500);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
