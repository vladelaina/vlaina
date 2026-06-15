import { expect, type Locator, type Page } from "@playwright/test";
import { BLOCK_CONTROLS_SELECTOR, EDITOR_SELECTOR } from "./notesE2E";
import type { BlockTextMatcher } from "./notesBlockSelectionDragHelpers";

export async function openBlockSelectionFixture(page: Page): Promise<void> {
  const { notePath } = await page.evaluate(() =>
    (window as any).__vlainaE2E.createNotesFixture({
      filename: 'block-selection.md',
      content: [
        '# Block Selection',
        '',
        'First selectable paragraph',
        '',
        'Second selectable paragraph',
        '',
        '- Parent item',
        '  ```js',
        '  const value = 1',
        '  ```',
        '',
        'Final paragraph',
        '',
      ].join('\n'),
    })
  );

  await page.evaluate((pathToOpen) => (window as any).__vlainaE2E.openAbsoluteNote(pathToOpen), notePath);
  await expect(page.locator(EDITOR_SELECTOR)).toBeVisible();
  await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'First selectable paragraph' })).toBeVisible();
  await expect(page.locator(`${EDITOR_SELECTOR} p`, { hasText: 'Second selectable paragraph' })).toBeVisible();
}

export async function expectSelectedParagraphs(page: Page, texts: string[]): Promise<void> {
  await expect.poll(async () => page.evaluate((expectedTexts) => {
    const selected = Array.from(document.querySelectorAll<HTMLElement>('.milkdown .ProseMirror .editor-block-selected'));
    return expectedTexts.map((text) => selected.some((element) => element.textContent?.includes(text)));
  }, texts)).toEqual(texts.map(() => true));
}

export async function selectNoteBlocksByMatchers(page: Page, matchers: BlockTextMatcher[]): Promise<void> {
  const result = await page.evaluate(async (targetMatchers) => {
    const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks() as Array<{
      text: string;
      tagName: string;
      from: number;
      to: number;
    }>;
    const usedIndexes = new Set<number>();
    const indexes: number[] = [];
    const missing: BlockTextMatcher[] = [];

    for (const matcher of targetMatchers) {
      const index = blocks.findIndex((block, blockIndex) => {
        if (usedIndexes.has(blockIndex)) return false;
        if (matcher.exact !== undefined && block.text !== matcher.exact) return false;
        if (matcher.include !== undefined && !block.text.includes(matcher.include)) return false;
        if (matcher.exclude?.some((text) => block.text.includes(text))) return false;
        return true;
      });
      if (index < 0) {
        missing.push(matcher);
        continue;
      }
      usedIndexes.add(index);
      indexes.push(index);
    }

    const count = missing.length === 0
      ? await (window as any).__vlainaE2E.selectNoteBlocksByIndexes(indexes)
      : 0;
    return {
      count,
      indexes,
      missing,
      blockTexts: blocks.map((block) => block.text),
    };
  }, matchers);

  expect(result.missing, `Missing selectable blocks from: ${JSON.stringify(result.blockTexts)}`).toEqual([]);
  expect(result.count).toBe(matchers.length);
}

export async function moveMouseToBlockHandleGutter(page: Page, locator: Locator): Promise<void> {
  const rect = await locator.boundingBox();
  if (!rect) {
    throw new Error('Could not resolve block geometry');
  }
  const targetCenterY = rect.y + rect.height / 2;
  const targetX = Math.max(8, rect.x - 18);
  await page.mouse.move(Math.max(8, targetX - 80), targetCenterY);
  await page.mouse.move(targetX, targetCenterY, { steps: 4 });
  await expect(page.locator(BLOCK_CONTROLS_SELECTOR)).toBeVisible();
  await expect.poll(async () => page.evaluate(({ controlsSelector, expectedCenterY }) => {
    const controls = document.querySelector<HTMLElement>(controlsSelector);
    if (!controls) return Number.POSITIVE_INFINITY;
    const controlsRect = controls.getBoundingClientRect();
    return Math.abs((controlsRect.top + controlsRect.height / 2) - expectedCenterY);
  }, { controlsSelector: BLOCK_CONTROLS_SELECTOR, expectedCenterY: targetCenterY }), {
    message: 'Expected block controls to align with the hovered block',
  }).toBeLessThanOrEqual(2);
}

export async function measureVisibleHandleGeometry(
  page: Page,
  input: {
    targetSelector: string;
    targetText: string;
    anchorSelector?: string;
    anchorText?: string;
  },
): Promise<{
  controlsCenterY: number;
  targetCenterY: number;
  targetGapX: number;
  anchorGapX: number;
  targetIndentFromAnchorX: number;
}> {
  const geometry = await page.evaluate(({ targetSelector, targetText, anchorSelector, anchorText }) => {
    const findElement = (selector: string, text: string) => (
      Array.from(document.querySelectorAll<HTMLElement>(selector))
        .find((element) => element.textContent?.includes(text)) ?? null
    );
    const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible');
    const target = findElement(targetSelector, targetText);
    const anchor = anchorSelector && anchorText
      ? findElement(anchorSelector, anchorText)
      : target;
    if (!controls || !target || !anchor) return null;

    const controlsRect = controls.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    return {
      controlsCenterY: controlsRect.top + controlsRect.height / 2,
      targetCenterY: targetRect.top + targetRect.height / 2,
      targetGapX: targetRect.left - controlsRect.left,
      anchorGapX: anchorRect.left - controlsRect.left,
      targetIndentFromAnchorX: targetRect.left - anchorRect.left,
    };
  }, input);

  expect(geometry).not.toBeNull();
  return geometry!;
}

export function expectHandleCenteredOnTarget(geometry: { controlsCenterY: number; targetCenterY: number }): void {
  expect(Math.abs(geometry.controlsCenterY - geometry.targetCenterY)).toBeLessThanOrEqual(2);
}

export function expectHandleAnchoredToListRow(geometry: {
  controlsCenterY: number;
  targetCenterY: number;
  targetGapX: number;
}): void {
  expectHandleCenteredOnTarget(geometry);
  expect(geometry.targetGapX).toBeGreaterThan(48);
  expect(geometry.targetGapX).toBeLessThan(88);
}

export function expectHandleAnchoredToOuterListRow(geometry: {
  controlsCenterY: number;
  targetCenterY: number;
  targetGapX: number;
  anchorGapX: number;
  targetIndentFromAnchorX: number;
}): void {
  expectHandleCenteredOnTarget(geometry);
  expect(geometry.anchorGapX).toBeGreaterThan(48);
  expect(geometry.anchorGapX).toBeLessThan(88);
  expect(geometry.targetIndentFromAnchorX).toBeGreaterThan(16);
  expect(geometry.targetGapX).toBeGreaterThan(geometry.anchorGapX + 16);
}

export async function measureCollapseToggleClearance(
  page: Page,
  input: {
    targetSelector: string;
    targetText: string;
    toggleSelector: string;
  },
): Promise<{
  handleGapX: number;
}> {
  const geometry = await page.evaluate(({ targetSelector, targetText, toggleSelector }) => {
    const target = Array.from(document.querySelectorAll<HTMLElement>(targetSelector))
      .find((element) => element.textContent?.includes(targetText)) ?? null;
    const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible, .editor-block-controls.dragging');
    const toggle = target?.querySelector<HTMLElement>(toggleSelector) ?? null;
    if (!target || !controls || !toggle) return null;

    const controlsRect = controls.getBoundingClientRect();
    const toggleRect = toggle.getBoundingClientRect();

    return {
      handleGapX: toggleRect.left - controlsRect.right,
    };
  }, input);

  expect(geometry).not.toBeNull();
  return geometry!;
}
