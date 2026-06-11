import { expect, type Locator, type Page } from '@playwright/test';
import { BLOCK_CONTROLS_SELECTOR, EDITOR_SELECTOR } from './notesE2E';

export type BlockTextMatcher = {
  include?: string;
  exact?: string;
  exclude?: string[];
};

export type MarkdownDragSyntaxCase = {
  label: string;
  targetSelector: string;
  targetText?: string;
  match?: BlockTextMatcher;
  gap: 'standard' | 'list' | 'nested-list';
  anchorSelector?: string;
  anchorText?: string;
};

export type SyntaxHandleGeometry = {
  label: string;
  selectedCount: number;
  selectedMatchesTarget: boolean;
  targetTagName: string;
  targetClassName: string;
  targetText: string;
  controlsCenterY: number;
  targetCenterY: number;
  targetGapX: number;
  handleRightGapX: number;
  anchorGapX: number | null;
  targetIndentFromAnchorX: number | null;
};

type DragVisualGeometry = {
  dragActive: boolean;
  controlsDragging: boolean;
  sourceCount: number;
  selectedCount: number;
  sourceBackgroundColor: string | null;
  sourceBoxShadow: string | null;
  sourceOpacity: string | null;
  sourceAfterBackgroundColor: string | null;
  sourceAfterLeft: number | null;
  sourceAfterRight: number | null;
  sourceBleedStart: number | null;
  sourceBleedEnd: number | null;
  expectedBackground: string;
  previewExists: boolean;
  previewWidth: number | null;
  previewHeight: number | null;
  previewBackgroundColor: string | null;
  previewOpacity: string | null;
  previewBoxShadow: string | null;
  previewLayerBackgroundColor: string | null;
  previewLayerOpacity: string | null;
  previewLayerBoxShadow: string | null;
  controlsBeforeBackgroundColor: string | null;
};

export const MARKDOWN_DRAG_SYNTAX_CASES: MarkdownDragSyntaxCase[] = [
  {
    label: 'atx-heading',
    targetSelector: 'h2',
    targetText: 'Inline Marks And Links',
    gap: 'standard',
  },
  {
    label: 'inline-rich-paragraph',
    targetSelector: 'p',
    targetText: 'Inline marks paragraph',
    gap: 'standard',
  },
  {
    label: 'multi-line-blockquote',
    targetSelector: 'blockquote',
    targetText: 'Regular quote line one.',
    gap: 'standard',
  },
  {
    label: 'blockquote-list-item',
    targetSelector: 'blockquote li',
    targetText: 'Nested quote bullet sentinel',
    gap: 'standard',
  },
  {
    label: 'top-level-bullet',
    targetSelector: 'ul > li',
    targetText: 'Bullet item alpha',
    gap: 'list',
  },
  {
    label: 'third-level-bullet',
    targetSelector: 'li li li',
    targetText: 'Third-level bullet sentinel',
    gap: 'nested-list',
    anchorSelector: 'ul > li',
    anchorText: 'Bullet item beta',
  },
  {
    label: 'ordered-list-item',
    targetSelector: 'ol > li',
    targetText: 'Ordered item beta',
    gap: 'list',
  },
  {
    label: 'parenthesized-ordered-item',
    targetSelector: 'ol > li',
    targetText: 'Parenthesized ordered item beta',
    gap: 'list',
  },
  {
    label: 'task-list-item',
    targetSelector: 'li[data-item-type="task"]',
    targetText: 'Task item unchecked sentinel',
    gap: 'list',
  },
  {
    label: 'nested-task-list-item',
    targetSelector: 'li li[data-item-type="task"]',
    targetText: 'Nested task item sentinel',
    gap: 'nested-list',
    anchorSelector: 'li[data-item-type="task"]',
    anchorText: 'Task item checked sentinel',
  },
  {
    label: 'markdown-table',
    targetSelector: '.milkdown-table-block',
    targetText: 'Table alpha',
    gap: 'standard',
  },
  {
    label: 'fenced-code-block',
    targetSelector: '.code-block-container',
    targetText: 'syntaxSentinel',
    gap: 'standard',
  },
  {
    label: 'inline-math-paragraph',
    targetSelector: 'p',
    targetText: 'Inline math sentinel',
    gap: 'standard',
  },
  {
    label: 'math-block',
    targetSelector: 'div[data-type="math-block"]',
    targetText: 'E=mc',
    gap: 'standard',
  },
  {
    label: 'mermaid-block',
    targetSelector: 'div[data-type="mermaid"]',
    targetText: 'E2E Start',
    gap: 'standard',
  },
  {
    label: 'aligned-paragraph',
    targetSelector: 'p',
    targetText: 'Centered paragraph sentinel.',
    gap: 'standard',
  },
];

export function locateSyntaxTarget(page: Page, sample: MarkdownDragSyntaxCase): Locator {
  const selector = `${EDITOR_SELECTOR} ${sample.targetSelector}`;
  return sample.targetText
    ? page.locator(selector, { hasText: sample.targetText }).first()
    : page.locator(selector).first();
}

export async function measureSelectedSurfaceCoverage(
  page: Page,
  input: {
    targetSelector: string;
    targetText: string;
  },
): Promise<{
  controlsLeft: number;
  controlsRight: number;
  visualLeft: number;
  visualRight: number;
  bleedStart: number;
  bleedEnd: number;
  backgroundColor: string;
  boxShadow: string;
  afterBackgroundColor: string;
  afterLeft: number | null;
  afterRight: number | null;
  expectedBackground: string;
}> {
  const geometry = await page.evaluate(({ targetSelector, targetText }) => {
    const target = Array.from(document.querySelectorAll<HTMLElement>(targetSelector))
      .find((element) => element.textContent?.includes(targetText)) ?? null;
    const selected = target?.classList.contains('editor-block-selected')
      ? target
      : target?.querySelector<HTMLElement>('.editor-block-selected') ?? null;
    const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible, .editor-block-controls.dragging');
    if (!selected || !controls) return null;

    const selectedRect = selected.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();
    const selectedStyles = getComputedStyle(selected);
    const afterStyles = getComputedStyle(selected, '::after');
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--vlaina-block-selection-color-default)';
    document.body.appendChild(probe);
    const expectedBackground = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const bleedStart = Number.parseFloat(selectedStyles.getPropertyValue('--vlaina-block-selection-bleed-x-start')) || 0;
    const bleedEnd = Number.parseFloat(selectedStyles.getPropertyValue('--vlaina-block-selection-bleed-x-end')) || 0;
    const afterLeft = Number.parseFloat(afterStyles.left);
    const afterRight = Number.parseFloat(afterStyles.right);

    return {
      controlsLeft: controlsRect.left,
      controlsRight: controlsRect.right,
      visualLeft: selectedRect.left - bleedStart,
      visualRight: selectedRect.right + bleedEnd,
      bleedStart,
      bleedEnd,
      backgroundColor: selectedStyles.backgroundColor,
      boxShadow: selectedStyles.boxShadow,
      afterBackgroundColor: afterStyles.backgroundColor,
      afterLeft: Number.isFinite(afterLeft) ? afterLeft : null,
      afterRight: Number.isFinite(afterRight) ? afterRight : null,
      expectedBackground,
    };
  }, input);

  expect(geometry).not.toBeNull();
  return geometry!;
}

export async function moveMouseToSyntaxHandleGutter(page: Page, sample: MarkdownDragSyntaxCase): Promise<void> {
  const probe = await page.evaluate(async ({ editorSelector, syntaxCase }) => {
    const normalize = (value: string | undefined | null) => (value ?? '').replace(/\s+/g, ' ').trim();
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const scrollRoot = editor?.closest<HTMLElement>('[data-note-scroll-root="true"]') ?? null;
    if (!editor || !scrollRoot) {
      return {
        ok: false,
        reason: 'editor-or-scroll-root-missing',
        expectedCenterY: 0,
        points: [] as Array<{ x: number; y: number }>,
      };
    }

    const target = Array.from(editor.querySelectorAll<HTMLElement>(syntaxCase.targetSelector))
      .find((element) => !syntaxCase.targetText || normalize(element.textContent).includes(syntaxCase.targetText))
      ?? null;
    const selectedElements = Array.from(document.querySelectorAll<HTMLElement>(`${editorSelector} .editor-block-selected`));
    const selected = selectedElements.find((element) => (
      target !== null && (
        element === target ||
        target.contains(element) ||
        element.contains(target)
      )
    )) ?? selectedElements[0] ?? null;
    const anchor = selected ?? target;
    if (!anchor) {
      return {
        ok: false,
        reason: 'selected-or-target-missing',
        expectedCenterY: 0,
        points: [] as Array<{ x: number; y: number }>,
      };
    }

    anchor.scrollIntoView({ block: 'center', inline: 'nearest' });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const selectedRect = selected?.getBoundingClientRect() ?? null;
    const targetRect = target?.getBoundingClientRect() ?? null;
    const anchorRect = selectedRect ?? targetRect;
    const scrollRect = scrollRoot.getBoundingClientRect();
    if (!anchorRect) {
      return {
        ok: false,
        reason: 'anchor-rect-missing',
        expectedCenterY: 0,
        points: [] as Array<{ x: number; y: number }>,
      };
    }

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const centerY = clamp(
      anchorRect.top + anchorRect.height / 2,
      scrollRect.top + 12,
      scrollRect.bottom - 12,
    );
    const left = anchorRect.left;
    const points = [
      { x: Math.max(8, left - 18), y: centerY },
      { x: Math.max(8, left - 8), y: centerY },
      { x: Math.max(8, left + 4), y: centerY },
    ];

    if (targetRect && targetRect.left !== left) {
      points.push({
        x: Math.max(8, targetRect.left - 18),
        y: clamp(targetRect.top + targetRect.height / 2, scrollRect.top + 12, scrollRect.bottom - 12),
      });
    }

    return {
      ok: true,
      reason: null,
      selectedText: normalize(selected?.textContent).slice(0, 160),
      targetText: normalize(target?.textContent).slice(0, 160),
      selectedRect: selectedRect
        ? {
            left: Math.round(selectedRect.left * 10) / 10,
            top: Math.round(selectedRect.top * 10) / 10,
            width: Math.round(selectedRect.width * 10) / 10,
            height: Math.round(selectedRect.height * 10) / 10,
          }
        : null,
      targetRect: targetRect
        ? {
            left: Math.round(targetRect.left * 10) / 10,
            top: Math.round(targetRect.top * 10) / 10,
            width: Math.round(targetRect.width * 10) / 10,
            height: Math.round(targetRect.height * 10) / 10,
          }
        : null,
      expectedCenterY: centerY,
      points,
    };
  }, { editorSelector: EDITOR_SELECTOR, syntaxCase: sample });

  expect(probe.ok, `${sample.label}: ${probe.reason}\n${JSON.stringify(probe, null, 2)}`).toBe(true);

  for (const point of probe.points) {
    await page.mouse.move(point.x, point.y);
    const aligned = await page.waitForFunction(
      ({ expectedCenterY }) => {
        const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible');
        if (!controls) return false;
        const rect = controls.getBoundingClientRect();
        const controlsCenterY = rect.top + rect.height / 2;
        return Math.abs(controlsCenterY - expectedCenterY) <= 8;
      },
      { expectedCenterY: probe.expectedCenterY },
      { timeout: 650 },
    ).then(() => true).catch(() => false);
    if (aligned) return;
  }

  throw new Error(`${sample.label}: block controls did not become visible\n${JSON.stringify(probe, null, 2)}`);
}

export async function selectSyntaxDragCase(page: Page, sample: MarkdownDragSyntaxCase): Promise<void> {
  const result = await page.evaluate(async ({ editorSelector, syntaxCase }) => {
    const normalize = (value: string | undefined | null) => (value ?? '').replace(/\s+/g, ' ').trim();
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) {
      return { ok: false, reason: 'editor-missing', blockTexts: [] as string[] };
    }

    const target = Array.from(editor.querySelectorAll<HTMLElement>(syntaxCase.targetSelector))
      .find((element) => !syntaxCase.targetText || normalize(element.textContent).includes(syntaxCase.targetText))
      ?? null;
    if (!target) {
      return {
        ok: false,
        reason: 'target-missing',
        blockTexts: [] as string[],
      };
    }

    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const targetText = normalize(target.textContent);
    const targetTextFallback = normalize(syntaxCase.targetText);
    const blocks = (window as any).__vlainaE2E.getNoteSelectableBlocks() as Array<{
      text: string;
      tagName: string;
    }>;
    const scoreBlock = (block: { text: string }) => {
      const blockText = normalize(block.text);
      const matcher = syntaxCase.match;
      if (matcher) {
        if (matcher.exact !== undefined && blockText !== matcher.exact) return -1;
        if (matcher.include !== undefined && !blockText.includes(matcher.include)) return -1;
        if (matcher.exclude?.some((text) => blockText.includes(text))) return -1;
        return 0;
      }

      if (targetText && blockText === targetText) return 0;
      if (targetText && blockText.length > 0 && targetText.includes(blockText)) return 1;
      if (targetTextFallback.length >= 3 && blockText.includes(targetTextFallback)) return 2;
      if (targetText && blockText.includes(targetText)) return 3;

      return -1;
    };

    const scoredMatches = blocks
      .map((block, index) => ({ block, index, score: scoreBlock(block) }))
      .filter((candidate) => candidate.score >= 0)
      .sort((left, right) => (
        left.score - right.score ||
        normalize(left.block.text).length - normalize(right.block.text).length ||
        left.index - right.index
      ));
    const index = scoredMatches[0]?.index ?? -1;
    if (index < 0) {
      return {
        ok: false,
        reason: 'selectable-target-missing',
        targetText,
        blockTexts: blocks.map((block) => block.text),
      };
    }

    const count = await (window as any).__vlainaE2E.selectNoteBlocksByIndexes([index]);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return {
      ok: count === 1,
      reason: count === 1 ? null : 'selection-count-mismatch',
      count,
      index,
      targetText,
      blockText: blocks[index]?.text ?? '',
      blockTexts: blocks.map((block) => block.text),
    };
  }, { editorSelector: EDITOR_SELECTOR, syntaxCase: sample });

  expect(result.ok, `${sample.label}: ${result.reason}\n${JSON.stringify(result, null, 2)}`).toBe(true);
}

export async function measureSyntaxHandleGeometry(
  page: Page,
  sample: MarkdownDragSyntaxCase,
): Promise<SyntaxHandleGeometry> {
  const geometry = await page.evaluate(({ editorSelector, syntaxCase }) => {
    const normalize = (value: string | undefined | null) => (value ?? '').replace(/\s+/g, ' ').trim();
    const editor = document.querySelector<HTMLElement>(editorSelector);
    if (!editor) return null;

    const findElement = (selector: string, text?: string) => (
      Array.from(editor.querySelectorAll<HTMLElement>(selector))
        .find((element) => !text || normalize(element.textContent).includes(text))
      ?? null
    );

    const controls = document.querySelector<HTMLElement>('.editor-block-controls.visible');
    const target = findElement(syntaxCase.targetSelector, syntaxCase.targetText);
    const selectedElements = Array.from(document.querySelectorAll<HTMLElement>(`${editorSelector} .editor-block-selected`));
    const selected = selectedElements.find((element) => (
      target !== null && (
        element === target ||
        target.contains(element) ||
        element.contains(target)
      )
    )) ?? selectedElements[0] ?? null;
    if (!controls || !target || !selected) return null;

    const anchor = syntaxCase.anchorSelector
      ? findElement(syntaxCase.anchorSelector, syntaxCase.anchorText)
      : null;
    const controlsRect = controls.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    const anchorRect = anchor?.getBoundingClientRect() ?? null;

    return {
      label: syntaxCase.label,
      selectedCount: selectedElements.length,
      selectedMatchesTarget: (
        selected === target ||
        target.contains(selected) ||
        selected.contains(target)
      ),
      targetTagName: target.tagName,
      targetClassName: target.className,
      targetText: normalize(target.textContent).slice(0, 160),
      controlsCenterY: controlsRect.top + controlsRect.height / 2,
      targetCenterY: selectedRect.top + selectedRect.height / 2,
      targetGapX: selectedRect.left - controlsRect.left,
      handleRightGapX: selectedRect.left - controlsRect.right,
      anchorGapX: anchorRect ? anchorRect.left - controlsRect.left : null,
      targetIndentFromAnchorX: anchorRect ? selectedRect.left - anchorRect.left : null,
    };
  }, { editorSelector: EDITOR_SELECTOR, syntaxCase: sample });

  expect(geometry, `${sample.label}: missing handle geometry`).not.toBeNull();
  return geometry!;
}

export function expectSyntaxHandleGeometry(
  sample: MarkdownDragSyntaxCase,
  geometry: SyntaxHandleGeometry,
  options: { expectedSelectedCount?: number } = {},
): void {
  const expectedSelectedCount = options.expectedSelectedCount ?? 1;
  const ranges = {
    standard: { min: 24, max: 120 },
    list: { min: 48, max: 144 },
    'nested-list': { min: 64, max: 180 },
  }[sample.gap];

  expect(geometry.selectedCount, `${sample.label}: selected block count`).toBe(expectedSelectedCount);
  expect(geometry.selectedMatchesTarget, `${sample.label}: selected block should wrap target`).toBe(true);
  expect(
    Math.abs(geometry.controlsCenterY - geometry.targetCenterY),
    `${sample.label}: handle should be vertically centered on target`,
  ).toBeLessThanOrEqual(4);
  expect(geometry.targetGapX, `${sample.label}: handle-to-target gap`).toBeGreaterThanOrEqual(ranges.min);
  expect(geometry.targetGapX, `${sample.label}: handle-to-target gap`).toBeLessThanOrEqual(ranges.max);
  expect(geometry.handleRightGapX, `${sample.label}: handle should stay before target text`).toBeGreaterThanOrEqual(4);

  if (sample.anchorSelector) {
    expect(geometry.anchorGapX, `${sample.label}: anchor gap`).not.toBeNull();
    expect(geometry.targetIndentFromAnchorX, `${sample.label}: nested indent`).not.toBeNull();
    expect(geometry.targetIndentFromAnchorX!, `${sample.label}: nested target should stay indented`).toBeGreaterThan(16);
    expect(geometry.targetGapX, `${sample.label}: nested handle should account for target indent`)
      .toBeGreaterThan(geometry.anchorGapX! + 16);
  }
}

export async function dragVisibleHandleAndMeasure(page: Page, label: string): Promise<DragVisualGeometry> {
  const handleBox = await page.locator('.editor-block-control-handle').boundingBox();
  if (!handleBox) {
    throw new Error(`${label}: could not resolve block drag handle geometry`);
  }

  const dragStartX = handleBox.x + handleBox.width / 2;
  const dragStartY = handleBox.y + handleBox.height / 2;
  let mouseIsDown = false;

  try {
    await page.mouse.move(dragStartX, dragStartY);
    await page.mouse.down();
    mouseIsDown = true;
    await page.mouse.move(dragStartX + 28, dragStartY, { steps: 4 });

    await expect.poll(async () => page.evaluate(() =>
      document.body.classList.contains('editor-block-drag-active')
    ), { message: `${label}: drag session should become active` }).toBe(true);

    const visual = await page.evaluate((editorSelector) => {
      const probe = document.createElement('span');
      probe.style.backgroundColor = 'var(--vlaina-block-selection-color-default)';
      document.body.appendChild(probe);
      const expectedBackground = getComputedStyle(probe).backgroundColor;
      probe.remove();

      const source = document.querySelector<HTMLElement>(
        `${editorSelector} .editor-block-drag-source, ${editorSelector} .editor-block-selected`
      );
      const sourceStyle = source ? getComputedStyle(source) : null;
      const sourceAfterStyle = source ? getComputedStyle(source, '::after') : null;
      const sourceAfterLeft = sourceAfterStyle ? Number.parseFloat(sourceAfterStyle.left) : Number.NaN;
      const sourceAfterRight = sourceAfterStyle ? Number.parseFloat(sourceAfterStyle.right) : Number.NaN;
      const sourceBleedStart = sourceStyle
        ? Number.parseFloat(sourceStyle.getPropertyValue('--vlaina-block-selection-bleed-x-start'))
        : Number.NaN;
      const sourceBleedEnd = sourceStyle
        ? Number.parseFloat(sourceStyle.getPropertyValue('--vlaina-block-selection-bleed-x-end'))
        : Number.NaN;
      const preview = document.querySelector<HTMLElement>('.editor-block-drag-preview');
      const previewLayer = preview?.querySelector<HTMLElement>('.editor-block-drag-preview-layer') ?? null;
      const previewStyle = preview ? getComputedStyle(preview) : null;
      const previewLayerStyle = previewLayer ? getComputedStyle(previewLayer) : null;
      const previewRect = preview?.getBoundingClientRect() ?? null;
      const controls = document.querySelector<HTMLElement>('.editor-block-controls.dragging, .editor-block-controls.visible');
      const controlsBeforeStyle = controls ? getComputedStyle(controls, '::before') : null;

      return {
        dragActive: document.body.classList.contains('editor-block-drag-active'),
        controlsDragging: controls?.classList.contains('dragging') ?? false,
        sourceCount: document.querySelectorAll(`${editorSelector} .editor-block-drag-source`).length,
        selectedCount: document.querySelectorAll(`${editorSelector} .editor-block-selected`).length,
        sourceBackgroundColor: sourceStyle?.backgroundColor ?? null,
        sourceBoxShadow: sourceStyle?.boxShadow ?? null,
        sourceOpacity: sourceStyle?.opacity ?? null,
        sourceAfterBackgroundColor: sourceAfterStyle?.backgroundColor ?? null,
        sourceAfterLeft: Number.isFinite(sourceAfterLeft) ? sourceAfterLeft : null,
        sourceAfterRight: Number.isFinite(sourceAfterRight) ? sourceAfterRight : null,
        sourceBleedStart: Number.isFinite(sourceBleedStart) ? sourceBleedStart : null,
        sourceBleedEnd: Number.isFinite(sourceBleedEnd) ? sourceBleedEnd : null,
        expectedBackground,
        previewExists: preview !== null,
        previewWidth: previewRect ? Math.round(previewRect.width * 10) / 10 : null,
        previewHeight: previewRect ? Math.round(previewRect.height * 10) / 10 : null,
        previewBackgroundColor: previewStyle?.backgroundColor ?? null,
        previewOpacity: previewStyle?.opacity ?? null,
        previewBoxShadow: previewStyle?.boxShadow ?? null,
        previewLayerBackgroundColor: previewLayerStyle?.backgroundColor ?? null,
        previewLayerOpacity: previewLayerStyle?.opacity ?? null,
        previewLayerBoxShadow: previewLayerStyle?.boxShadow ?? null,
        controlsBeforeBackgroundColor: controlsBeforeStyle?.backgroundColor ?? null,
      };
    }, EDITOR_SELECTOR);

    await page.mouse.move(dragStartX, dragStartY, { steps: 2 });
    return visual;
  } finally {
    if (mouseIsDown) {
      await page.mouse.up().catch(() => undefined);
    }
    await page.mouse.move(8, 8).catch(() => undefined);
    await expect.poll(async () => page.evaluate(() =>
      document.body.classList.contains('editor-block-drag-active')
    ), { message: `${label}: drag session should stop after mouse up` }).toBe(false);
  }
}

export function expectTransparentDragVisual(label: string, visual: DragVisualGeometry): void {
  expect(visual.dragActive, `${label}: drag active`).toBe(true);
  expect(visual.controlsDragging, `${label}: controls dragging class`).toBe(true);
  expect(visual.selectedCount + visual.sourceCount, `${label}: selected/source count`).toBeGreaterThan(0);
  expectDragSourceSelectionSurface(label, visual);
  expect(visual.sourceOpacity, `${label}: source opacity`).toBe('1');
  expect(visual.previewExists, `${label}: preview should exist`).toBe(true);
  expect(visual.previewWidth ?? 0, `${label}: preview width`).toBeGreaterThan(0);
  expect(visual.previewHeight ?? 0, `${label}: preview height`).toBeGreaterThan(0);
  expect(visual.previewBackgroundColor, `${label}: preview background`).toBe('rgba(0, 0, 0, 0)');
  expect(visual.previewOpacity, `${label}: preview opacity`).toBe('1');
  expect(visual.previewBoxShadow, `${label}: preview shadow`).toBe('none');
  expect(visual.previewLayerBackgroundColor, `${label}: preview layer background`).toBe('rgba(0, 0, 0, 0)');
  expect(visual.previewLayerOpacity, `${label}: preview layer opacity`).toBe('1');
  expect(visual.previewLayerBoxShadow, `${label}: preview layer shadow`).toBe('none');
  expect(visual.controlsBeforeBackgroundColor, `${label}: handle pseudo background`).toBe('rgba(0, 0, 0, 0)');
}

export function expectDragSourceSelectionSurface(
  label: string,
  visual: Pick<DragVisualGeometry,
    | 'sourceBackgroundColor'
    | 'sourceBoxShadow'
    | 'sourceAfterBackgroundColor'
    | 'sourceAfterLeft'
    | 'sourceAfterRight'
    | 'sourceBleedStart'
    | 'sourceBleedEnd'
    | 'expectedBackground'
  >,
): void {
  if (visual.sourceBackgroundColor === visual.expectedBackground) {
    return;
  }

  expect(visual.sourceBackgroundColor, `${label}: text source element background`).toBe('rgba(0, 0, 0, 0)');
  expect(visual.sourceBoxShadow, `${label}: text source element shadow`).toBe('none');
  expect(visual.sourceAfterBackgroundColor, `${label}: source selection pseudo background`).toBe(visual.expectedBackground);
  expect(visual.sourceAfterLeft, `${label}: source selection pseudo left`).not.toBeNull();
  expect(visual.sourceAfterRight, `${label}: source selection pseudo right`).not.toBeNull();
  expect(visual.sourceBleedStart, `${label}: source bleed start`).not.toBeNull();
  expect(visual.sourceBleedEnd, `${label}: source bleed end`).not.toBeNull();
  expect(visual.sourceAfterLeft!, `${label}: source pseudo should preserve left bleed`)
    .toBeCloseTo(-visual.sourceBleedStart!, 0);
  expect(visual.sourceAfterRight!, `${label}: source pseudo should preserve right bleed`)
    .toBeCloseTo(-visual.sourceBleedEnd!, 0);
}
