import {
  TOP_LEVEL_LAYOUT_DECORATION_CLASS_NAMES,
  TOP_LEVEL_LAYOUT_DECORATION_STYLE_PROPS,
  copyAllowedClasses,
  mirrorLayoutStyles,
} from './appliedPreviewLayoutTokens';

function hasTopLevelLayoutDecoration(element: HTMLElement): boolean {
  return TOP_LEVEL_LAYOUT_DECORATION_CLASS_NAMES.some((className) => element.classList.contains(className));
}

function canMirrorTopLevelLayoutDecoration(sourceElement: HTMLElement, previewElement: HTMLElement): boolean {
  return (
    sourceElement.tagName === previewElement.tagName &&
    hasTopLevelLayoutDecoration(sourceElement)
  );
}

export function stabilizePreviewTopLevelLayoutDecorations(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
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
    if (!previewElement || !canMirrorTopLevelLayoutDecoration(sourceElement, previewElement)) {
      return;
    }

    copyAllowedClasses(sourceElement, previewElement, TOP_LEVEL_LAYOUT_DECORATION_CLASS_NAMES);
    if (sourceElement.hasAttribute('data-task')) {
      previewElement.setAttribute('data-task', sourceElement.getAttribute('data-task') ?? '');
    }
    if (sourceElement.hasAttribute('aria-checked')) {
      previewElement.setAttribute('aria-checked', sourceElement.getAttribute('aria-checked') ?? '');
    }
    mirrorLayoutStyles(sourceElement, previewElement, TOP_LEVEL_LAYOUT_DECORATION_STYLE_PROPS);
  });
}
