import { expect, test, type Page } from '@playwright/test';
import {
  EDITOR_SELECTOR,
  cleanupIsolatedElectron,
  getOpenBridgePages,
  installReferenceTyporaTheme,
  launchIsolatedElectron,
  openMarkdownFixture,
} from './notesE2E';

type CollapseTogglePositionSample = {
  kind: 'heading' | 'list';
  label: string;
  toggleLeft: number;
  toggleRight: number;
  textLeft: number;
  itemLeft: number;
  guardLeft: number;
  isTask: boolean;
  collapsed: boolean;
  computedLeft: string;
  computedPosition: string;
  fontSize: number;
  headingPosVar?: string;
  listPosVar: string;
  parentTag: string;
  offsetParentTag: string | null;
};

function createCollapsePositionFixture(): string {
  return [
    '# Heading One Collapse Alpha',
    '',
    'Heading one body alpha',
    '',
    '## Heading Two Collapse Alpha',
    '',
    'Heading two body alpha',
    '',
    '### Heading Three Collapse Alpha',
    '',
    'Heading three body alpha',
    '',
    '#### Heading Four Collapse Alpha',
    '',
    'Heading four body alpha',
    '',
    '##### Heading Five Collapse Alpha',
    '',
    'Heading five body alpha',
    '',
    '###### Heading Six Collapse Alpha',
    '',
    'Heading six body alpha',
    '',
    '# List Collapse Position Matrix',
    '',
    '- Bullet parent alpha',
    '  - Bullet child alpha',
    '',
    '1. Ordered parent alpha',
    '   1. Ordered child alpha',
    '',
    '111. Wide ordered parent alpha',
    '     1. Wide ordered child alpha',
    '',
    '- [ ] Task parent alpha',
    '  - Task child alpha',
    '',
    '- [x] Checked task parent alpha',
    '  - Checked task child alpha',
    '',
    '- Bullet parent with task child alpha',
    '  - [ ] Nested task parent alpha',
    '    - Nested task child alpha',
    '',
    '- Parent with nested ordered alpha',
    '  1. Nested ordered child alpha',
    '',
  ].join('\n');
}

async function collectCollapseTogglePositionSamples(page: Page): Promise<CollapseTogglePositionSample[]> {
  return page.evaluate((editorSelector) => {
    function findDirectToggle(item: HTMLElement): HTMLElement | null {
      return Array.from(item.querySelectorAll<HTMLElement>('.editor-collapse-btn[data-has-content="true"]'))
        .find((toggle) => toggle.closest('li') === item) ?? null;
    }

    function findDirectTextBlock(item: HTMLElement): HTMLElement | null {
      return item.querySelector(':scope > [data-text-align], :scope > p');
    }

    function findFirstTextLeftInBrowser(block: HTMLElement): number {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.textContent?.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      });
      const textNode = walker.nextNode();
      if (!textNode) return block.getBoundingClientRect().left;

      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, Math.min(1, textNode.textContent?.length ?? 1));
      const rect = range.getClientRects()[0] ?? block.getBoundingClientRect();
      range.detach();
      return rect.left;
    }

    function resolveGuardLeft(item: HTMLElement, textLeft: number): number {
      if (item.dataset.itemType !== 'task') return textLeft;

      const itemStyle = window.getComputedStyle(item);
      const beforeStyle = window.getComputedStyle(item, '::before');
      const gap = Number.parseFloat(itemStyle.columnGap || itemStyle.gap || '8') || 8;
      const checkboxSize = Number.parseFloat(beforeStyle.width || '') || 16;
      return textLeft - gap - checkboxSize;
    }

    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) return [];

    const headingSamples = Array.from(editor.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))
      .map((heading) => {
        const toggle = heading.querySelector<HTMLElement>(':scope > .heading-toggle-btn[data-has-content="true"]');
        if (!toggle) return null;

        const toggleRect = toggle.getBoundingClientRect();
        const toggleStyle = window.getComputedStyle(toggle);
        const blockStyle = window.getComputedStyle(heading);
        const headingRect = heading.getBoundingClientRect();
        const textLeft = findFirstTextLeftInBrowser(heading);
        return {
          kind: 'heading' as const,
          label: heading.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          toggleLeft: toggleRect.left,
          toggleRight: toggleRect.right,
          textLeft,
          itemLeft: headingRect.left,
          guardLeft: textLeft,
          isTask: false,
          collapsed: toggle.dataset.collapsed === 'true',
          computedLeft: toggleStyle.left,
          computedPosition: toggleStyle.position,
          fontSize: Number.parseFloat(blockStyle.fontSize || '0') || 0,
          headingPosVar: toggleStyle.getPropertyValue('--vlaina-editor-collapse-pos-heading').trim(),
          listPosVar: toggleStyle.getPropertyValue('--vlaina-editor-collapse-pos-list').trim(),
          parentTag: toggle.parentElement?.tagName ?? '',
          offsetParentTag: toggle.offsetParent instanceof HTMLElement ? toggle.offsetParent.tagName : null,
        };
      })
      .filter((sample): sample is CollapseTogglePositionSample => sample !== null);

    const listSamples = Array.from(editor.querySelectorAll<HTMLElement>('li'))
      .map((item) => {
        const toggle = findDirectToggle(item);
        const textBlock = findDirectTextBlock(item);
        if (!toggle || !textBlock) return null;

        const toggleRect = toggle.getBoundingClientRect();
        const toggleStyle = window.getComputedStyle(toggle);
        const blockStyle = window.getComputedStyle(textBlock);
        const itemRect = item.getBoundingClientRect();
        const textLeft = findFirstTextLeftInBrowser(textBlock);
        const guardLeft = resolveGuardLeft(item, textLeft);
        return {
          kind: 'list' as const,
          label: textBlock.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          toggleLeft: toggleRect.left,
          toggleRight: toggleRect.right,
          textLeft,
          itemLeft: itemRect.left,
          guardLeft,
          isTask: item.dataset.itemType === 'task',
          collapsed: toggle.dataset.collapsed === 'true',
          computedLeft: toggleStyle.left,
          computedPosition: toggleStyle.position,
          fontSize: Number.parseFloat(blockStyle.fontSize || '0') || 0,
          headingPosVar: toggleStyle.getPropertyValue('--vlaina-editor-collapse-pos-heading').trim(),
          listPosVar: toggleStyle.getPropertyValue('--vlaina-editor-collapse-pos-list').trim(),
          parentTag: toggle.parentElement?.tagName ?? '',
          offsetParentTag: toggle.offsetParent instanceof HTMLElement ? toggle.offsetParent.tagName : null,
        };
      })
      .filter((sample): sample is CollapseTogglePositionSample => sample !== null);

    return [...headingSamples, ...listSamples];
  }, EDITOR_SELECTOR);
}

async function expectCollapseTogglesBeforeText(page: Page): Promise<void> {
  const samples = await collectCollapseTogglePositionSamples(page);
  expect(samples.filter((sample) => sample.kind === 'heading').length).toBeGreaterThanOrEqual(6);
  expect(samples.filter((sample) => sample.kind === 'list').length).toBeGreaterThanOrEqual(8);

  const violations = samples.filter((sample) => sample.toggleRight > sample.guardLeft - 4);
  expect(violations, JSON.stringify(samples, null, 2)).toEqual([]);
}

async function expectHeadingCollapseTogglesKeepLargeFontGap(page: Page): Promise<void> {
  const samples = (await collectCollapseTogglePositionSamples(page))
    .filter((sample) => sample.kind === 'heading');
  expect(samples.length).toBeGreaterThanOrEqual(6);

  const violations = samples.filter((sample) => {
    const requiredTextGap = Math.max(4, sample.fontSize * 0.2);
    return sample.textLeft - sample.toggleRight < requiredTextGap;
  });
  expect(violations, JSON.stringify(samples, null, 2)).toEqual([]);
}

async function expectListCollapseTogglesKeepLargeFontGap(page: Page): Promise<void> {
  const samples = (await collectCollapseTogglePositionSamples(page))
    .filter((sample) => sample.kind === 'list');
  expect(samples.length).toBeGreaterThanOrEqual(8);

  const violations = samples.filter((sample) => {
    const requiredMarkerReserve = Math.max(28, sample.fontSize * 0.7);
    return sample.itemLeft - sample.toggleRight < requiredMarkerReserve;
  });
  expect(violations, JSON.stringify(samples, null, 2)).toEqual([]);
}

test.describe('notes collapse controls', () => {
  test.setTimeout(120_000);

  test('keeps heading and list collapse toggles before text across block shapes', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-list-collapse-position');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await openMarkdownFixture(page, {
        filename: 'list-collapse-position.md',
        content: createCollapsePositionFixture(),
      });

      await expect.poll(async () =>
        page.locator(`${EDITOR_SELECTOR} .editor-collapse-btn[data-has-content="true"]`).count()
      ).toBeGreaterThanOrEqual(8);
      await expectCollapseTogglesBeforeText(page);

      await page.locator(`${EDITOR_SELECTOR} .editor-collapse-btn[data-has-content="true"]`).first().click();
      await expect(page.locator(`${EDITOR_SELECTOR} .editor-collapse-btn[data-collapsed="true"]`)).toHaveCount(1);
      await expectCollapseTogglesBeforeText(page);

      const themeInstall = await installReferenceTyporaTheme(page);
      if (!themeInstall.skipped) {
        await expectCollapseTogglesBeforeText(page);
      }

      await page.evaluate(() => (window as any).__vlainaE2E.setUIPreferences({ fontSize: 120 }));
      await expect.poll(async () =>
        page.evaluate(() => {
          const editor = document.querySelector<HTMLElement>('.milkdown .ProseMirror');
          return editor ? Number.parseFloat(window.getComputedStyle(editor).fontSize || '0') : 0;
        })
      ).toBeGreaterThan(100);
      await expectHeadingCollapseTogglesKeepLargeFontGap(page);
      await expectListCollapseTogglesKeepLargeFontGap(page);
      await page.locator(`${EDITOR_SELECTOR} .heading-toggle-btn[data-has-content="true"]`).first().click();
      await expect(page.locator(`${EDITOR_SELECTOR} .heading-toggle-btn[data-collapsed="true"]`)).toHaveCount(1);
      await page.locator(`${EDITOR_SELECTOR} .editor-collapse-btn[data-has-content="true"]`).first().click();
      await expect(page.locator(`${EDITOR_SELECTOR} .editor-collapse-btn[data-collapsed="true"]`)).toHaveCount(0);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
