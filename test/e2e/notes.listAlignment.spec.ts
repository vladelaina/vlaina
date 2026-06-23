import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

type AlignedListMarkerSample = {
  label: string;
  textAlign: string;
  listStylePosition: string;
  itemClassName: string;
  blockDisplay: string;
  blockLeft: number;
  blockRight: number;
  blockWidth: number;
  itemLeft: number;
  itemRight: number;
  itemWidth: number;
  lineCount: number;
};

function createAlignedListFixture(): string {
  return [
    '# Aligned List Marker Fixture',
    '',
    '- Center aligned bullet marker sentinel first line  ',
    '  Center aligned bullet marker sentinel second line',
    '  <!--align:center-->',
    '- Right aligned bullet marker sentinel first line  ',
    '  Right aligned bullet marker sentinel second line',
    '  <!--align:right-->',
    '',
    '1. Center aligned ordered marker sentinel first line  ',
    '   Center aligned ordered marker sentinel second line',
    '   <!--align:center-->',
    '2. Right aligned ordered marker sentinel first line  ',
    '   Right aligned ordered marker sentinel second line',
    '   <!--align:right-->',
    '',
  ].join('\n');
}

async function collectAlignedListMarkerSamples(page: Page): Promise<AlignedListMarkerSample[]> {
  return page.evaluate((editorSelector) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) return [];

    return Array.from(editor.querySelectorAll<HTMLElement>('li'))
      .map((item) => {
        const block = item.querySelector<HTMLElement>(':scope > [data-text-align], :scope > p');
        const label = block?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        if (!block || !label.includes('aligned')) return null;

        const itemStyle = window.getComputedStyle(item);
        const blockStyle = window.getComputedStyle(block);
        const itemRect = item.getBoundingClientRect();
        const blockRect = block.getBoundingClientRect();
        const textRange = document.createRange();
        textRange.selectNodeContents(block);
        const lineCount = Array.from(textRange.getClientRects())
          .filter((rect) => rect.width > 0 && rect.height > 0)
          .length;
        textRange.detach();
        return {
          label,
          textAlign: itemStyle.textAlign,
          listStylePosition: itemStyle.listStylePosition,
          itemClassName: item.className,
          blockDisplay: blockStyle.display,
          blockLeft: blockRect.left,
          blockRight: blockRect.right,
          blockWidth: blockRect.width,
          itemLeft: itemRect.left,
          itemRight: itemRect.right,
          itemWidth: itemRect.width,
          lineCount,
        };
      })
      .filter((sample): sample is AlignedListMarkerSample => sample !== null);
  }, EDITOR_SELECTOR);
}

test.describe('notes list alignment', () => {
  test.setTimeout(90_000);

  test('keeps bullet and ordered markers before aligned list text', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-list-alignment-markers');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openMarkdownFixture(page, {
        filename: 'list-alignment-markers.md',
        content: createAlignedListFixture(),
      });

      await expect.poll(async () => collectAlignedListMarkerSamples(page)).toHaveLength(4);

      const samples = await collectAlignedListMarkerSamples(page);
      expect(samples.map((sample) => sample.label)).toEqual([
        'Center aligned bullet marker sentinel first lineCenter aligned bullet marker sentinel second line',
        'Right aligned bullet marker sentinel first lineRight aligned bullet marker sentinel second line',
        'Center aligned ordered marker sentinel first lineCenter aligned ordered marker sentinel second line',
        'Right aligned ordered marker sentinel first lineRight aligned ordered marker sentinel second line',
      ]);

      for (const sample of samples) {
        const expectedAlign = sample.label.startsWith('Center') ? 'center' : 'right';
        const leftSpace = sample.blockLeft - sample.itemLeft;
        const rightSpace = sample.itemRight - sample.blockRight;
        expect(sample.textAlign, sample.label).toBe(expectedAlign);
        expect(sample.itemClassName, sample.label).toContain(`editor-list-item-align-${expectedAlign}`);
        expect(sample.listStylePosition, sample.label).toBe('outside');
        expect(sample.blockDisplay, sample.label).toBe('block');
        expect(sample.blockWidth, sample.label).toBeLessThan(sample.itemWidth);
        expect(sample.lineCount, sample.label).toBeGreaterThanOrEqual(2);
        if (expectedAlign === 'center') {
          expect(Math.abs(leftSpace - rightSpace), sample.label).toBeLessThanOrEqual(10);
        } else {
          expect(rightSpace, sample.label).toBeLessThanOrEqual(1);
        }
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
