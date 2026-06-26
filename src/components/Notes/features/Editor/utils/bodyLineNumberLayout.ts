import {
  getMarkdownBodySourceLineNumbers,
  isInternalMarkdownBodyLinePlaceholder,
} from './bodyLineNumbers';

const BODY_LINE_NUMBER_LABEL_WIDTH = 40;
const BODY_LINE_NUMBER_LABEL_GAP = 18;
const MAX_BODY_LINE_NUMBER_TEXT_ANCHOR_SCAN_NODES = 256;

export const MAX_BODY_LINE_NUMBER_TARGETS = 5000;
export const MAX_BODY_LINE_NUMBER_PRECISE_TEXT_ANCHOR_TARGETS = 400;
export const MAX_BODY_LINE_NUMBER_LIST_SCAN_ELEMENTS = 10000;
export const MAX_BODY_LINE_NUMBER_SELECTION_SCAN_ELEMENTS = 20000;

export interface BodyLineNumberLabel {
  lineNumber: number;
  top: number;
  left: number;
}

function isCodeOrFrontmatterBlock(element: HTMLElement): boolean {
  return element.classList.contains('code-block-container')
    || element.classList.contains('frontmatter-block-container');
}

function isInternalPlaceholderElement(element: HTMLElement): boolean {
  if (element.classList.contains('editor-editable-markdown-blank-line')) return true;
  if (element.classList.contains('editor-empty-paragraph')) return true;
  return element.dataset.type === 'html-block'
    && isInternalMarkdownBodyLinePlaceholder(element.dataset.value ?? '');
}

function shouldSkipBodyLineNumberTarget(element: HTMLElement): boolean {
  return isCodeOrFrontmatterBlock(element) || isInternalPlaceholderElement(element);
}

export function collectBodyLineNumberTargets(editorRoot: HTMLElement): HTMLElement[] {
  const targets: HTMLElement[] = [];

  for (let index = 0; index < editorRoot.children.length && targets.length < MAX_BODY_LINE_NUMBER_TARGETS; index += 1) {
    const child = editorRoot.children.item(index);
    if (!(child instanceof HTMLElement)) continue;
    if (shouldSkipBodyLineNumberTarget(child)) continue;

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
        if (node.closest('.code-block-container, .frontmatter-block-container')) continue;
        if (isInternalPlaceholderElement(node)) continue;
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

function shouldIgnoreAnchorElement(target: HTMLElement, element: HTMLElement): boolean {
  if (!target.contains(element)) return true;
  if (element.closest('.code-block-container, .frontmatter-block-container')) return true;
  if (element.closest('.body-line-number-gutter')) return true;
  if (target.tagName === 'LI' && element.closest('li') !== target) return true;

  for (let current: HTMLElement | null = element; current && current !== target.parentElement; current = current.parentElement) {
    if (current.getAttribute('aria-hidden') === 'true') return true;
    if (current.getAttribute('contenteditable') === 'false') return true;
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

function resolveFirstTextLineRect(target: HTMLElement): DOMRect | null {
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
    if (!parent || shouldIgnoreAnchorElement(target, parent)) continue;

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

function resolveBodyLineNumberAnchorTop(shellRect: DOMRect, target: HTMLElement, usePreciseTextAnchor: boolean): number {
  const targetRect = target.getBoundingClientRect();
  if (usePreciseTextAnchor) {
    const textLineRect = resolveFirstTextLineRect(target);
    if (textLineRect) {
      return textLineRect.top - shellRect.top + textLineRect.height / 2;
    }
  }

  return targetRect.top - shellRect.top + targetRect.height / 2;
}

export function resolveBodyLineNumberLabels(shell: HTMLElement, markdown: string): BodyLineNumberLabel[] {
  const editorRoot = shell.querySelector<HTMLElement>('.ProseMirror');
  if (!editorRoot) return [];

  const sourceLineNumbers = getMarkdownBodySourceLineNumbers(markdown);
  const targets = collectBodyLineNumberTargets(editorRoot);
  const selectedDescendantTargets = collectSelectedBlockDescendantTargets(editorRoot);
  const shellRect = shell.getBoundingClientRect();
  const editorRect = editorRoot.getBoundingClientRect();
  const left = Math.max(
    0,
    editorRect.left - shellRect.left - BODY_LINE_NUMBER_LABEL_GAP - BODY_LINE_NUMBER_LABEL_WIDTH
  );
  const labelCount = Math.min(sourceLineNumbers.length, targets.length);
  const usePreciseTextAnchors = labelCount <= MAX_BODY_LINE_NUMBER_PRECISE_TEXT_ANCHOR_TARGETS;
  const labels: BodyLineNumberLabel[] = [];

  for (let index = 0; index < labelCount; index += 1) {
    const target = targets[index];
    if (!target || isInsideSelectedBlock(target, selectedDescendantTargets)) {
      continue;
    }

    labels.push({
      lineNumber: sourceLineNumbers[index],
      top: resolveBodyLineNumberAnchorTop(shellRect, target, usePreciseTextAnchors),
      left,
    });
  }

  return labels;
}
