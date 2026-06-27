import {
  getMarkdownBodyLineNumbers,
  isNonNumberedMarkdownBodyLinePlaceholder,
} from './bodyLineNumbers';

const BODY_LINE_NUMBER_LABEL_WIDTH = 40;
const BODY_LINE_NUMBER_LABEL_GAP = 18;
const MAX_BODY_LINE_NUMBER_TEXT_ANCHOR_SCAN_NODES = 256;
const MAX_BODY_LINE_NUMBER_TABLE_CELL_ANCHOR_SCAN_ELEMENTS = 128;
const HIDDEN_DEFINITION_TEXT_PATTERN = /^(?:\[[^\]\n]+]:\s+\S|\*\[[^\]\n]+]:\s+\S)/;
const SELF_CLOSING_RAW_MEDIA_HTML_TEXT_PATTERN = /^<(?:video|audio)\b[^>]*\/>$/i;

export const MAX_BODY_LINE_NUMBER_TARGETS = 5000;
export const MAX_BODY_LINE_NUMBER_PRECISE_TEXT_ANCHOR_TARGETS = 400;
export const MAX_BODY_LINE_NUMBER_LIST_SCAN_ELEMENTS = 10000;
export const MAX_BODY_LINE_NUMBER_SELECTION_SCAN_ELEMENTS = 20000;

export interface BodyLineNumberLabel {
  lineNumber: number;
  top: number;
  left: number;
}

function isFrontmatterBlock(element: HTMLElement): boolean {
  return element.classList.contains('frontmatter-block-container');
}

function isNonNumberedPlaceholderElement(element: HTMLElement): boolean {
  return element.dataset.type === 'html-block'
    && isNonNumberedMarkdownBodyLinePlaceholder(element.dataset.value ?? '');
}

function isHiddenDefinitionElement(element: HTMLElement): boolean {
  return HIDDEN_DEFINITION_TEXT_PATTERN.test((element.textContent ?? '').trim());
}

function isUnsupportedSelfClosingRawMediaElement(element: HTMLElement): boolean {
  return SELF_CLOSING_RAW_MEDIA_HTML_TEXT_PATTERN.test((element.textContent ?? '').trim());
}

function shouldSkipBodyLineNumberTarget(element: HTMLElement): boolean {
  return isFrontmatterBlock(element)
    || isNonNumberedPlaceholderElement(element)
    || isHiddenDefinitionElement(element)
    || isUnsupportedSelfClosingRawMediaElement(element);
}

function isCodeBlockTarget(element: HTMLElement): boolean {
  return element.classList.contains('code-block-container')
    || element.matches('pre[data-language], pre.code-block-wrapper');
}

function collectCodeBlockLineNumberTargets(codeBlock: HTMLElement): HTMLElement[] {
  const codeRoot = codeBlock.querySelector<HTMLElement>('.cm-content')
    ?? codeBlock.querySelector<HTMLElement>('.code-block-lazy-preview, pre, code')
    ?? codeBlock;
  const lines = Array.from(codeRoot.querySelectorAll<HTMLElement>('.cm-line'))
    .filter((line) =>
      line.closest('.code-block-container, pre[data-language], pre.code-block-wrapper') === codeBlock
      && line.closest('.cm-gutters, .cm-gutter, .cm-lineNumbers') === null
    );

  if (lines.length > 0) return lines;
  return [codeRoot];
}

function isTableBlockTarget(element: HTMLElement): boolean {
  return element.classList.contains('milkdown-table-block') || element.tagName.toLowerCase() === 'table';
}

function collectTableRowLineNumberTargets(tableBlock: HTMLElement): HTMLElement[] {
  const table = tableBlock.tagName.toLowerCase() === 'table'
    ? tableBlock
    : tableBlock.querySelector<HTMLElement>('table');
  if (!table) return [tableBlock];

  const rows = Array.from(table.querySelectorAll<HTMLElement>('tr'))
    .filter((row) => row.closest('table') === table);
  return rows.length > 0 ? rows : [tableBlock];
}

export function collectBodyLineNumberTargets(editorRoot: HTMLElement): HTMLElement[] {
  const targets: HTMLElement[] = [];

  for (let index = 0; index < editorRoot.children.length && targets.length < MAX_BODY_LINE_NUMBER_TARGETS; index += 1) {
    const child = editorRoot.children.item(index);
    if (!(child instanceof HTMLElement)) continue;
    if (shouldSkipBodyLineNumberTarget(child)) continue;
    if (isCodeBlockTarget(child)) {
      for (const lineTarget of collectCodeBlockLineNumberTargets(child)) {
        if (targets.length >= MAX_BODY_LINE_NUMBER_TARGETS) break;
        targets.push(lineTarget);
      }
      continue;
    }
    if (isTableBlockTarget(child)) {
      for (const rowTarget of collectTableRowLineNumberTargets(child)) {
        if (targets.length >= MAX_BODY_LINE_NUMBER_TARGETS) break;
        targets.push(rowTarget);
      }
      continue;
    }

    const tagName = child.tagName.toLowerCase();
    if (tagName === 'ul' || tagName === 'ol') {
      const walker = child.ownerDocument.createTreeWalker(child, NodeFilter.SHOW_ELEMENT);
      let scanned = 0;
      for (
        let node = walker.nextNode();
        node && targets.length < MAX_BODY_LINE_NUMBER_TARGETS && scanned < MAX_BODY_LINE_NUMBER_LIST_SCAN_ELEMENTS;
        node = walker.nextNode()
      ) {
        scanned += 1;
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName.toLowerCase() !== 'li') continue;
        if (node.closest('.frontmatter-block-container')) continue;
        if (isNonNumberedPlaceholderElement(node)) continue;
        if (isHiddenDefinitionElement(node)) continue;
        if (isUnsupportedSelfClosingRawMediaElement(node)) continue;
        targets.push(node);
      }
      continue;
    }

    targets.push(child);
  }

  return targets;
}

function collectSelectedBlockDescendantTargets(editorRoot: HTMLElement): WeakSet<HTMLElement> {
  const selectedDescendantTargets = new WeakSet<HTMLElement>();
  const walker = editorRoot.ownerDocument.createTreeWalker(editorRoot, NodeFilter.SHOW_ELEMENT);
  let scanned = 0;

  for (
    let node = walker.nextNode();
    node && scanned < MAX_BODY_LINE_NUMBER_SELECTION_SCAN_ELEMENTS;
    node = walker.nextNode()
  ) {
    scanned += 1;
    if (!(node instanceof HTMLElement) || !node.classList.contains('editor-block-selected')) {
      continue;
    }

    for (
      let ancestor = node.parentElement;
      ancestor && ancestor !== editorRoot;
      ancestor = ancestor.parentElement
    ) {
      selectedDescendantTargets.add(ancestor);
    }
  }

  return selectedDescendantTargets;
}

function isInsideSelectedBlock(target: HTMLElement, selectedDescendantTargets: WeakSet<HTMLElement>): boolean {
  return target.classList.contains('editor-block-selected')
    || target.closest('.editor-block-selected') !== null
    || selectedDescendantTargets.has(target);
}

interface BodyLineNumberAnchorOptions {
  allowContentEditableFalse?: boolean;
}

function shouldIgnoreAnchorElement(
  target: HTMLElement,
  element: HTMLElement,
  options: BodyLineNumberAnchorOptions = {},
): boolean {
  if (!target.contains(element)) return true;
  if (element.closest('.frontmatter-block-container')) return true;
  const codeBlock = element.closest('.code-block-container');
  if (codeBlock && codeBlock !== target && !codeBlock.contains(target) && !target.contains(codeBlock)) return true;
  if (element.closest('.body-line-number-gutter')) return true;
  if (target.tagName === 'LI' && element.closest('li') !== target) return true;

  for (let current: HTMLElement | null = element; current && current !== target.parentElement; current = current.parentElement) {
    if (current.getAttribute('aria-hidden') === 'true') return true;
    if (current.matches('.cm-gutters, .cm-gutter, .cm-gutterElement, .cm-lineNumbers')) return true;
    if (!options.allowContentEditableFalse && current.getAttribute('contenteditable') === 'false') return true;
    if (current.matches('button, .editor-collapse-btn, .callout-icon, .callout-title-inner')) return true;
  }

  return false;
}

function getFirstVisibleClientRect(rects: DOMRectList): DOMRect | null {
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects.item?.(index) ?? (rects as ArrayLike<DOMRect>)[index];
    if (!rect) continue;
    if (rect.width <= 0 && rect.height <= 0) continue;
    return rect;
  }
  return null;
}

function resolveFirstTextLineRect(
  target: HTMLElement,
  options: BodyLineNumberAnchorOptions = {},
): DOMRect | null {
  const doc = target.ownerDocument;
  const walker = doc.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  let scanned = 0;

  for (
    let node = walker.nextNode();
    node && scanned < MAX_BODY_LINE_NUMBER_TEXT_ANCHOR_SCAN_NODES;
    node = walker.nextNode()
  ) {
    scanned += 1;
    if (!node.textContent?.trim()) continue;
    const parent = node.parentElement;
    if (!parent || shouldIgnoreAnchorElement(target, parent, options)) continue;

    const range = doc.createRange();
    try {
      range.selectNodeContents(node);
      const rect = getFirstVisibleClientRect(range.getClientRects());
      if (rect) return rect;
    } finally {
      range.detach();
    }
  }

  return null;
}

function isTableLineNumberTarget(target: HTMLElement): boolean {
  const tagName = target.tagName.toLowerCase();
  return target.classList.contains('milkdown-table-block')
    || tagName === 'table'
    || (tagName === 'tr' && target.closest('table') !== null);
}

function isCodeBlockLineNumberTarget(target: HTMLElement): boolean {
  return target.classList.contains('code-block-container')
    || target.matches('pre[data-language], pre.code-block-wrapper');
}

function isMediaLineNumberTarget(target: HTMLElement): boolean {
  if (
    target.classList.contains('editor-paragraph-has-image-block')
    || target.classList.contains('image-block-container')
    || target.classList.contains('video-block')
    || target.dataset.type === 'video'
  ) {
    return true;
  }

  return target.dataset.type === 'html-block'
    && target.querySelector('img, video, audio, iframe, source, track') !== null;
}

function resolveMediaVisualRect(target: HTMLElement): DOMRect | null {
  if (
    target.classList.contains('image-block-container')
    || target.classList.contains('video-block')
    || target.dataset.type === 'video'
  ) {
    return getVisibleRect(target);
  }

  const visualMedia = target.querySelector<HTMLElement>(
    '.image-block-container, .video-block, [data-type="video"], img, video, audio, iframe'
  );
  return visualMedia ? getVisibleRect(visualMedia) : getVisibleRect(target);
}

function getVisibleRect(element: HTMLElement): DOMRect | null {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return null;
  return rect;
}

function resolveFirstTableLineRect(target: HTMLElement): DOMRect | null {
  const doc = target.ownerDocument;
  const walker = doc.createTreeWalker(target, NodeFilter.SHOW_ELEMENT);
  let scannedCells = 0;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node instanceof HTMLElement)) continue;
    const tagName = node.tagName.toLowerCase();
    if (tagName !== 'th' && tagName !== 'td') continue;
    scannedCells += 1;
    if (scannedCells > MAX_BODY_LINE_NUMBER_TABLE_CELL_ANCHOR_SCAN_ELEMENTS) break;

    const textLineRect = resolveFirstTextLineRect(node, { allowContentEditableFalse: true });
    if (textLineRect) return textLineRect;
  }

  const firstRow = target.querySelector<HTMLElement>('tr');
  return firstRow ? getVisibleRect(firstRow) : null;
}

function resolveFirstCodeBlockLineRect(target: HTMLElement): DOMRect | null {
  const codeBody = target.querySelector<HTMLElement>(
    '.code-block-editable, .code-block-lazy-preview, .cm-content, pre, code'
  );
  return resolveFirstTextLineRect(codeBody ?? target, { allowContentEditableFalse: true });
}

function resolveBodyLineNumberAnchorTop(shellRect: DOMRect, target: HTMLElement, usePreciseTextAnchor: boolean): number {
  const targetRect = target.getBoundingClientRect();
  if (usePreciseTextAnchor && isMediaLineNumberTarget(target)) {
    const mediaRect = resolveMediaVisualRect(target);
    if (mediaRect) {
      return mediaRect.top - shellRect.top + mediaRect.height / 2;
    }
  }

  if (usePreciseTextAnchor && isTableLineNumberTarget(target)) {
    const tableLineRect = resolveFirstTableLineRect(target);
    if (tableLineRect) {
      return tableLineRect.top - shellRect.top + tableLineRect.height / 2;
    }
  }

  if (usePreciseTextAnchor && isCodeBlockLineNumberTarget(target)) {
    const codeLineRect = resolveFirstCodeBlockLineRect(target);
    if (codeLineRect) {
      return codeLineRect.top - shellRect.top + codeLineRect.height / 2;
    }
  }

  if (usePreciseTextAnchor) {
    const textLineRect = resolveFirstTextLineRect(target);
    if (textLineRect) {
      return textLineRect.top - shellRect.top + textLineRect.height / 2;
    }
  }

  return targetRect.top - shellRect.top + targetRect.height / 2;
}

function resolveTableContentLeft(target: HTMLElement): number | null {
  if (!isTableLineNumberTarget(target)) return null;

  const tableRoot = target.classList.contains('milkdown-table-block')
    ? target
    : target.closest<HTMLElement>('.milkdown-table-block')
      ?? (target.tagName.toLowerCase() === 'table' ? target : target.closest<HTMLElement>('table'));
  if (!tableRoot) return null;

  const tableAnchor = tableRoot.querySelector<HTMLElement>('.table-wrapper, .table-scroll, table')
    ?? (tableRoot.tagName.toLowerCase() === 'table' ? tableRoot : null);
  if (!tableAnchor) return null;

  return getVisibleRect(tableAnchor)?.left ?? null;
}

function resolveBodyLineNumberAnchorLeft(shellRect: DOMRect, editorRect: DOMRect, target: HTMLElement): number {
  const tableContentLeft = resolveTableContentLeft(target);
  const anchorLeft = tableContentLeft === null ? editorRect.left : Math.min(editorRect.left, tableContentLeft);
  return Math.max(
    0,
    anchorLeft - shellRect.left - BODY_LINE_NUMBER_LABEL_GAP - BODY_LINE_NUMBER_LABEL_WIDTH
  );
}

export function resolveBodyLineNumberLabels(shell: HTMLElement, markdown: string): BodyLineNumberLabel[] {
  const editorRoot = shell.querySelector<HTMLElement>('.ProseMirror');
  if (!editorRoot) return [];

  const bodyLineNumbers = getMarkdownBodyLineNumbers(markdown);
  const targets = collectBodyLineNumberTargets(editorRoot);
  const selectedDescendantTargets = collectSelectedBlockDescendantTargets(editorRoot);
  const shellRect = shell.getBoundingClientRect();
  const editorRect = editorRoot.getBoundingClientRect();
  const labelCount = Math.min(bodyLineNumbers.length, targets.length);
  const usePreciseTextAnchors = labelCount <= MAX_BODY_LINE_NUMBER_PRECISE_TEXT_ANCHOR_TARGETS;
  const labels: BodyLineNumberLabel[] = [];

  for (let index = 0; index < labelCount; index += 1) {
    const target = targets[index];
    if (!target || isInsideSelectedBlock(target, selectedDescendantTargets)) {
      continue;
    }

    labels.push({
      lineNumber: bodyLineNumbers[index],
      top: resolveBodyLineNumberAnchorTop(shellRect, target, usePreciseTextAnchors),
      left: resolveBodyLineNumberAnchorLeft(shellRect, editorRect, target),
    });
  }

  return labels;
}
