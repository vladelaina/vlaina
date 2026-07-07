import { IMAGE_BLOCK_CONTAINER_CLASS } from './appliedPreviewSourceNodes';
import {
  MEDIA_ADJACENT_LAYOUT_CLASS_NAMES,
  MEDIA_ADJACENT_LAYOUT_STYLE_PROPS,
  copyAllowedClasses,
  mirrorLayoutStyles,
} from './appliedPreviewLayoutTokens';

function canMirrorMediaAdjacentElement(sourceElement: HTMLElement, previewElement: HTMLElement): boolean {
  return (
    sourceElement.tagName === previewElement.tagName &&
    (sourceElement.tagName === 'P' || sourceElement.dataset.type === 'html-block') &&
    (sourceElement.dataset.type ?? '') === (previewElement.dataset.type ?? '')
  );
}

function hasDirectImageBlock(element: HTMLElement): boolean {
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    if (child.classList.contains(IMAGE_BLOCK_CONTAINER_CLASS)) {
      return true;
    }
  }
  return false;
}

function isMediaLayoutAnchor(element: HTMLElement | undefined): boolean {
  if (!element) {
    return false;
  }

  if (hasDirectImageBlock(element)) {
    return true;
  }

  if (element.dataset.type !== 'html-block') {
    return false;
  }

  return element.querySelector('img, iframe, video, object, embed') !== null;
}

function shouldMirrorMediaAdjacentLayout(elements: HTMLElement[], index: number): boolean {
  return (
    isMediaLayoutAnchor(elements[index]) ||
    isMediaLayoutAnchor(elements[index - 1]) ||
    isMediaLayoutAnchor(elements[index + 1])
  );
}

export function stabilizePreviewMediaAdjacentLayout(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom) {
    return;
  }

  const sourceElements = Array.from(sourceDom.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
  const previewElements = Array.from(previewDom.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
  if (sourceElements.length !== previewElements.length) {
    return;
  }

  sourceElements.forEach((sourceElement, index) => {
    const previewElement = previewElements[index];
    if (
      !previewElement ||
      !canMirrorMediaAdjacentElement(sourceElement, previewElement) ||
      !shouldMirrorMediaAdjacentLayout(sourceElements, index)
    ) {
      return;
    }

    copyAllowedClasses(sourceElement, previewElement, MEDIA_ADJACENT_LAYOUT_CLASS_NAMES);
    mirrorLayoutStyles(sourceElement, previewElement, MEDIA_ADJACENT_LAYOUT_STYLE_PROPS);
  });
}
