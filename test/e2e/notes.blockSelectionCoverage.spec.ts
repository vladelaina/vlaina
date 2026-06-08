import { expect, test } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  SELECTED_BLOCK_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  getSelectableBlocks,
  launchIsolatedElectron,
  openMarkdownFixture,
  selectNoteBlocksByIndexes,
} from './notesE2E';
import { createMarkdownSyntaxFixture } from './notesMarkdownSyntaxFixture';

type SelectionEdgeSample = {
  index: number;
  label: string;
  tagName: string;
  className: string;
  text: string;
  rawLeft: number;
  rawRight: number;
  visualLeft: number;
  visualRight: number;
  fillLeft: number | null;
  fillRight: number | null;
  baselineLeftDelta: number;
  baselineRightDelta: number;
  bleedStart: number;
  bleedEnd: number;
};

test.describe('notes block selection visual coverage', () => {
  test.setTimeout(120_000);

  test('keeps selected block edges aligned across supported markdown block types', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-block-selection-coverage');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[notes-milkdown-timing:') || text.includes('Error') || text.includes('error')) {
          console.info(`[notes-block-selection-coverage:console] ${text}`);
        }
      });
      page.on('pageerror', (error) => {
        console.info(`[notes-block-selection-coverage:pageerror] ${error.message}`);
      });
      await openMarkdownFixture(page, {
        filename: 'markdown-selection-warmup.md',
        content: ['# Selection Warmup', '', 'Warmup paragraph sentinel.'].join('\n'),
      });
      await openMarkdownFixture(page, {
        filename: 'markdown-selection-coverage.md',
        content: createMarkdownSyntaxFixture(),
      });

      const selectableBlocks = await getSelectableBlocks(page);
      expect(selectableBlocks.length).toBeGreaterThan(50);

      const baselineIndex = selectableBlocks.findIndex((block) =>
        block.text.includes('Inline marks paragraph'));
      expect(baselineIndex).toBeGreaterThanOrEqual(0);

      const baseline = await measureSelectedBlock(page, baselineIndex, 'baseline-paragraph');
      expect(baseline).not.toBeNull();

      const samples: SelectionEdgeSample[] = [];
      for (let index = 0; index < selectableBlocks.length; index += 1) {
        if (index === baselineIndex) continue;
        const sample = await measureSelectedBlock(page, index, `block-${index}`, baseline!);
        if (sample) samples.push(sample);
      }

      expect(samples.length).toBeGreaterThan(50);

      const outliers = samples.filter((sample) =>
        Math.abs(sample.baselineLeftDelta) > 4 || Math.abs(sample.baselineRightDelta) > 4);
      const sampledKinds = Array.from(new Set(samples.map((sample) => describeSelectedKind(sample))));
      console.info('[notes-block-selection-edge-samples]', {
        baseline,
        sampledCount: samples.length,
        sampledKinds,
        outliers,
      });

      expect(outliers).toEqual([]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});

async function measureSelectedBlock(
  page: import('@playwright/test').Page,
  index: number,
  label: string,
  baseline?: SelectionEdgeSample,
): Promise<SelectionEdgeSample | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const selectedCount = await selectNoteBlocksByIndexes(page, [index]);
    expect(selectedCount).toBe(1);
    const selectedReady = await page.waitForFunction(
      (selector) => document.querySelectorAll(selector).length > 0,
      SELECTED_BLOCK_SELECTOR,
      { timeout: 3000 },
    ).then(() => true).catch(() => false);
    if (selectedReady) break;
    if (attempt === 2) {
      await expect(page.locator(SELECTED_BLOCK_SELECTOR).first()).toBeVisible();
    }
    await page.waitForTimeout(250);
  }
  return page.evaluate(async ({ editorSelector, index, label, baseline }) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const selected = document.querySelector<HTMLElement>(`${editorSelector} .editor-block-selected`);
    if (!editor || !selected) return null;
    selected.scrollIntoView({ block: 'center', inline: 'nearest' });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const rect = selected.getBoundingClientRect();
    const styles = getComputedStyle(selected);
    const bleedStart = Number.parseFloat(styles.getPropertyValue('--vlaina-block-selection-bleed-x-start')) || 0;
    const bleedEnd = Number.parseFloat(styles.getPropertyValue('--vlaina-block-selection-bleed-x-end')) || 0;
    const selectedCenterY = rect.top + rect.height / 2;
    const lineFillRects = Array.from(
      document.querySelectorAll<HTMLElement>('.editor-block-selection-line-fill')
    ).map((fill) => fill.getBoundingClientRect())
      .filter((fillRect) => (
        fillRect.width > 0 &&
        fillRect.height > 0 &&
        selectedCenterY >= fillRect.top - 2 &&
        selectedCenterY <= fillRect.bottom + 2
      ));
    const rawVisualLeft = rect.left - bleedStart;
    const rawVisualRight = rect.right + bleedEnd;
    const fillLeft = lineFillRects.length > 0
      ? Math.min(...lineFillRects.map((fillRect) => fillRect.left))
      : null;
    const fillRight = lineFillRects.length > 0
      ? Math.max(...lineFillRects.map((fillRect) => fillRect.right))
      : null;
    const visualLeft = Math.round(Math.min(rawVisualLeft, fillLeft ?? rawVisualLeft) * 10) / 10;
    const visualRight = Math.round(Math.max(rawVisualRight, fillRight ?? rawVisualRight) * 10) / 10;
    return {
      index,
      label,
      tagName: selected.tagName,
      className: selected.className,
      text: selected.textContent?.trim().slice(0, 120) ?? '',
      rawLeft: Math.round(rect.left * 10) / 10,
      rawRight: Math.round(rect.right * 10) / 10,
      visualLeft,
      visualRight,
      fillLeft: fillLeft === null ? null : Math.round(fillLeft * 10) / 10,
      fillRight: fillRight === null ? null : Math.round(fillRight * 10) / 10,
      baselineLeftDelta: baseline ? Math.round((visualLeft - baseline.visualLeft) * 10) / 10 : 0,
      baselineRightDelta: baseline ? Math.round((visualRight - baseline.visualRight) * 10) / 10 : 0,
      bleedStart: Math.round(bleedStart * 10) / 10,
      bleedEnd: Math.round(bleedEnd * 10) / 10,
    };
  }, { editorSelector: EDITOR_SELECTOR, index, label, baseline });
}

function describeSelectedKind(sample: SelectionEdgeSample): string {
  if (sample.className.includes('frontmatter-block-container')) return 'frontmatter';
  if (sample.className.includes('toc-block')) return 'toc';
  if (sample.className.includes('code-block-container')) return 'code';
  if (sample.className.includes('math-block')) return 'math';
  if (sample.className.includes('mermaid-block')) return 'mermaid';
  if (sample.className.includes('image-block-container')) return 'image';
  if (sample.className.includes('video-block')) return 'video';
  if (sample.className.includes('milkdown-table-block')) return 'table';
  if (sample.className.includes('callout')) return 'callout';
  if (sample.tagName === 'LI') return 'list-item';
  if (sample.tagName === 'BLOCKQUOTE') return 'blockquote';
  if (/^H[1-6]$/.test(sample.tagName)) return 'heading';
  if (sample.className.includes('md-htmlblock')) return 'html-block';
  return sample.tagName.toLowerCase();
}
