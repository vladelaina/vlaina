import { collectAppliedPreviewElements } from './appliedPreviewCollect';
import {
  LIST_COLLAPSED_CONTENT_CLASS,
  TOP_LEVEL_LAYOUT_DECORATION_CLASS_NAMES,
  copyAllowedClasses,
} from './appliedPreviewLayoutTokens';

const LIST_LAYOUT_SELECTOR = 'ul, ol, li, li > p, li > [data-text-align]';

const LIST_LAYOUT_STYLE_PROPS = [
  'alignItems',
  'columnGap',
  'display',
  'flexBasis',
  'flexGrow',
  'flexShrink',
  'flexWrap',
  'justifyContent',
  'lineHeight',
  'listStylePosition',
  'listStyleType',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginTop',
  'maxWidth',
  'minWidth',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'rowGap',
  'width',
] as const;

function getListLayoutSignature(element: HTMLElement): string {
  const parentListItem = element.closest('li');
  const parentSignature = parentListItem && parentListItem !== element
    ? `:${parentListItem.dataset.itemType ?? ''}:${parentListItem.dataset.listType ?? ''}`
    : '';
  return [
    element.tagName,
    element.dataset.itemType ?? '',
    element.dataset.listType ?? '',
    element.dataset.textAlign ?? '',
    parentSignature,
  ].join(':');
}

function canMirrorListLayout(sourceElement: HTMLElement, previewElement: HTMLElement): boolean {
  return (
    sourceElement.tagName === previewElement.tagName &&
    getListLayoutSignature(sourceElement) === getListLayoutSignature(previewElement)
  );
}

export function stabilizePreviewListLayout(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom || typeof window === 'undefined') {
    return;
  }

  const sourceCollection = collectAppliedPreviewElements(
    sourceDom,
    (element) => element.matches(LIST_LAYOUT_SELECTOR)
  );
  const previewCollection = collectAppliedPreviewElements(
    previewDom,
    (element) => element.matches(LIST_LAYOUT_SELECTOR)
  );
  if (!sourceCollection.complete || !previewCollection.complete) {
    return;
  }

  const { elements: sourceElements } = sourceCollection;
  const { elements: previewElements } = previewCollection;
  if (sourceElements.length !== previewElements.length) {
    return;
  }

  sourceElements.forEach((sourceElement, index) => {
    const previewElement = previewElements[index];
    if (!previewElement || !canMirrorListLayout(sourceElement, previewElement)) {
      return;
    }

    if (sourceElement.classList.contains(LIST_COLLAPSED_CONTENT_CLASS)) {
      previewElement.classList.add(LIST_COLLAPSED_CONTENT_CLASS);
    }
    copyAllowedClasses(sourceElement, previewElement, TOP_LEVEL_LAYOUT_DECORATION_CLASS_NAMES);
    if (sourceElement.hasAttribute('data-task')) {
      previewElement.setAttribute('data-task', sourceElement.getAttribute('data-task') ?? '');
    }
    if (sourceElement.hasAttribute('aria-checked')) {
      previewElement.setAttribute('aria-checked', sourceElement.getAttribute('aria-checked') ?? '');
    }

    const computed = window.getComputedStyle(sourceElement);
    LIST_LAYOUT_STYLE_PROPS.forEach((prop) => {
      const value = computed[prop];
      if (value) {
        previewElement.style[prop] = value;
      }
    });
  });
}
