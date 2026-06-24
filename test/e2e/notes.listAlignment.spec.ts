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

type NestedListSpacingSample = {
  kind: string;
  previousToParentGap: number;
  parentToFirstChildGap: number;
  childSiblingGap: number;
  lastChildToNextParentGap: number;
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

function createNestedListSpacingFixture(): string {
  return [
    '# Nested List Spacing Fixture',
    '',
    '- Bullet spacing previous',
    '- Bullet spacing parent',
    '  - Bullet spacing child one',
    '  - Bullet spacing child two',
    '- Bullet spacing next',
    '',
    '1. Ordered spacing previous',
    '2. Ordered spacing parent',
    '   1. Ordered spacing child one',
    '   2. Ordered spacing child two',
    '3. Ordered spacing next',
    '',
    '- [ ] Task spacing previous',
    '- [ ] Task spacing parent',
    '  - [ ] Task spacing child one',
    '  - [ ] Task spacing child two',
    '- [ ] Task spacing next',
    '',
  ].join('\n');
}

function createTabNestedListSpacingFixture(): string {
  return [
    '# Tab Nested List Spacing Fixture',
    '',
    '- Bullet spacing previous',
    '- Bullet spacing parent',
    '- Bullet spacing child one',
    '- Bullet spacing child two',
    '- Bullet spacing next',
    '',
    '1. Ordered spacing previous',
    '2. Ordered spacing parent',
    '3. Ordered spacing child one',
    '4. Ordered spacing child two',
    '5. Ordered spacing next',
    '',
    '- [ ] Task spacing previous',
    '- [ ] Task spacing parent',
    '- [ ] Task spacing child one',
    '- [ ] Task spacing child two',
    '- [ ] Task spacing next',
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

async function setEditorSelectionInsideBlock(page: Page, text: string): Promise<void> {
  const selection = await page.evaluate((targetText) => {
    const bridge = (window as any).__vlainaE2E;
    const blocks = bridge.getNoteSelectableBlocks() as Array<{
      text: string;
      from: number;
      to: number;
    }>;
    const block = blocks.find((candidate) => candidate.text.includes(targetText));
    if (!block) return null;

    const textOffset = block.text.indexOf(targetText);
    const caretOffset = Math.max(1, textOffset + Math.min(targetText.length, Math.ceil(targetText.length / 2)));
    return bridge.setEditorSelectionRange(block.from + caretOffset);
  }, text);

  expect(selection, `Expected editor selection inside "${text}"`).not.toBeNull();
  await expect.poll(async () => page.evaluate(() => {
    const selectionSummary = (window as any).__vlainaE2E.getEditorSelectionSummary();
    return Boolean(selectionSummary?.empty);
  })).toBe(true);
}

async function indentListItemsWithTab(page: Page, labels: string[]): Promise<void> {
  for (const label of labels) {
    await setEditorSelectionInsideBlock(page, label);
    await page.keyboard.press('Tab');
  }
}

async function collectNestedListSpacingSamples(page: Page): Promise<NestedListSpacingSample[]> {
  return page.evaluate((editorSelector) => {
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) return [];

    const findBlock = (text: string): HTMLElement | null => {
      return Array.from(editor.querySelectorAll<HTMLElement>('li > p'))
        .find((block) => block.textContent?.trim() === text) ?? null;
    };

    const gap = (before: HTMLElement, after: HTMLElement): number => {
      const beforeRect = before.getBoundingClientRect();
      const afterRect = after.getBoundingClientRect();
      return Math.round((afterRect.top - beforeRect.bottom) * 100) / 100;
    };

    return [
      ['bullet', 'Bullet'],
      ['ordered', 'Ordered'],
      ['task', 'Task'],
    ].map(([kind, label]) => {
      const previous = findBlock(`${label} spacing previous`);
      const parent = findBlock(`${label} spacing parent`);
      const childOne = findBlock(`${label} spacing child one`);
      const childTwo = findBlock(`${label} spacing child two`);
      const next = findBlock(`${label} spacing next`);
      if (!previous || !parent || !childOne || !childTwo || !next) return null;

      return {
        kind,
        previousToParentGap: gap(previous, parent),
        parentToFirstChildGap: gap(parent, childOne),
        childSiblingGap: gap(childOne, childTwo),
        lastChildToNextParentGap: gap(childTwo, next),
      };
    }).filter((sample): sample is NestedListSpacingSample => sample !== null);
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

  test('keeps nested bullet, ordered, and task list spacing consistent', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-nested-list-spacing');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openMarkdownFixture(page, {
        filename: 'nested-list-spacing.md',
        content: createNestedListSpacingFixture(),
      });

      await expect.poll(async () => collectNestedListSpacingSamples(page)).toHaveLength(3);

      const samples = await collectNestedListSpacingSamples(page);
      for (const sample of samples) {
        const gaps = [
          sample.previousToParentGap,
          sample.parentToFirstChildGap,
          sample.childSiblingGap,
          sample.lastChildToNextParentGap,
        ];
        const minGap = Math.min(...gaps);
        const maxGap = Math.max(...gaps);

        expect(maxGap - minGap, `${sample.kind} list gaps: ${gaps.join(', ')}`).toBeLessThanOrEqual(1);
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });

  test('keeps spacing consistent after creating nested lists with Tab', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-tab-nested-list-spacing');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openMarkdownFixture(page, {
        filename: 'tab-nested-list-spacing.md',
        content: createTabNestedListSpacingFixture(),
      });

      await indentListItemsWithTab(page, [
        'Bullet spacing child one',
        'Bullet spacing child two',
        'Ordered spacing child one',
        'Ordered spacing child two',
        'Task spacing child one',
        'Task spacing child two',
      ]);

      await expect.poll(async () => collectNestedListSpacingSamples(page)).toHaveLength(3);

      const samples = await collectNestedListSpacingSamples(page);
      for (const sample of samples) {
        const gaps = [
          sample.previousToParentGap,
          sample.parentToFirstChildGap,
          sample.childSiblingGap,
          sample.lastChildToNextParentGap,
        ];
        const minGap = Math.min(...gaps);
        const maxGap = Math.max(...gaps);

        expect(maxGap - minGap, `${sample.kind} list gaps after Tab: ${gaps.join(', ')}`).toBeLessThanOrEqual(1);
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
