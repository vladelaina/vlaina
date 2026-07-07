import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange } from './blockSelectionUtils';
import { resolveSelectableBlockTargetByPos } from './blockUnitResolver';
import {
  DRAG_SOURCE_DIRECT_RICH_CHILD_SELECTOR,
  DRAG_SOURCE_TEXTLIKE_SELECTOR,
  SOURCE_CLASS,
  SOURCE_HAS_NEXT_CLASS,
  SOURCE_HAS_PREVIOUS_CLASS,
  SOURCE_PARENT_MARKER_CLASS,
  SOURCE_TEXTLIKE_CLASS,
  type BlockDragSourceMarkerHandle,
  type BlockDragSourceMarkerOptions,
} from './blockDragPreviewTypes';

function pushUniqueBlockDragSourceElement(elements: HTMLElement[], element: HTMLElement): void {
  if (elements.some((existing) => existing.contains(element))) {
    return;
  }
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    const existing = elements[index];
    if (existing && element.contains(existing)) {
      elements.splice(index, 1);
    }
  }
  elements.push(element);
}

function collectBlockDragSourceElements(view: EditorView, ranges: readonly BlockRange[]): HTMLElement[] {
  const elements: HTMLElement[] = [];

  for (const range of ranges) {
    const target = resolveSelectableBlockTargetByPos(view, range.from);
    const element = target?.subElement ?? target?.element;
    if (!element) continue;
    pushUniqueBlockDragSourceElement(elements, element);
  }

  view.dom
    .querySelectorAll<HTMLElement>('.editor-block-selected, .ProseMirror-selectednode')
    .forEach((element) => pushUniqueBlockDragSourceElement(elements, element));

  return elements;
}

export function collectBlockDragSourceParentMarkerElements(view: EditorView, sourceElements: readonly HTMLElement[]): HTMLElement[] {
  const elements: HTMLElement[] = [];
  for (const source of sourceElements) {
    if (source.matches('li, blockquote')) {
      continue;
    }
    const parent = source.closest('li, blockquote');
    if (!(parent instanceof HTMLElement) || !view.dom.contains(parent) || sourceElements.includes(parent)) {
      continue;
    }
    if (!elements.includes(parent)) {
      elements.push(parent);
    }
  }
  return elements;
}

function isTextLikeBlockDragSourceElement(element: HTMLElement): boolean {
  if (!element.matches(DRAG_SOURCE_TEXTLIKE_SELECTOR)) {
    return false;
  }
  return !Array.from(element.children).some((child) => (
    child instanceof HTMLElement && child.matches(DRAG_SOURCE_DIRECT_RICH_CHILD_SELECTOR)
  ));
}

function addBlockDragSourceClasses(sourceElements: readonly HTMLElement[]) {
  const sourceSet = new Set(sourceElements);
  for (const element of sourceElements) {
    element.classList.add(SOURCE_CLASS);
    if (isTextLikeBlockDragSourceElement(element)) {
      element.classList.add(SOURCE_TEXTLIKE_CLASS);
    }

    const next = element.nextElementSibling;
    if (next instanceof HTMLElement && sourceSet.has(next)) {
      element.classList.add(SOURCE_HAS_NEXT_CLASS);
    }

    const previous = element.previousElementSibling;
    if (previous instanceof HTMLElement && sourceSet.has(previous)) {
      element.classList.add(SOURCE_HAS_PREVIOUS_CLASS);
    }
  }
}

function removeBlockDragSourceClasses(sourceElements: readonly HTMLElement[]) {
  for (const element of sourceElements) {
    element.classList.remove(
      SOURCE_CLASS,
      SOURCE_TEXTLIKE_CLASS,
      SOURCE_HAS_NEXT_CLASS,
      SOURCE_HAS_PREVIOUS_CLASS,
    );
  }
}

export function createBlockDragSourceMarker({
  view,
  ranges,
}: BlockDragSourceMarkerOptions): BlockDragSourceMarkerHandle | null {
  const sourceElements = collectBlockDragSourceElements(view, ranges);
  if (sourceElements.length === 0) return null;
  const parentMarkerElements = collectBlockDragSourceParentMarkerElements(view, sourceElements);

  addBlockDragSourceClasses(sourceElements);
  parentMarkerElements.forEach((element) => element.classList.add(SOURCE_PARENT_MARKER_CLASS));

  return {
    destroy: () => {
      removeBlockDragSourceClasses(sourceElements);
      parentMarkerElements.forEach((element) => element.classList.remove(SOURCE_PARENT_MARKER_CLASS));
    },
  };
}
