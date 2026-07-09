import {
  MARKDOWN_BLANK_LINE_CLASS_NAMES,
  MARKDOWN_BLANK_LINE_STYLE_PROPS,
  MARKDOWN_BLANK_LINE_VALUE,
  RENDERED_HTML_BOUNDARY_BLANK_LINE_VALUE,
  copyAllowedClasses,
  mirrorLayoutStyles,
} from './appliedPreviewLayoutTokens';

const BLANK_LINE_HTML_BLOCK_VALUES = new Set([
  MARKDOWN_BLANK_LINE_VALUE,
  RENDERED_HTML_BOUNDARY_BLANK_LINE_VALUE,
]);

function isMarkdownBlankLineElement(element: HTMLElement): boolean {
  if (
    element.dataset.type === 'html-block' &&
    BLANK_LINE_HTML_BLOCK_VALUES.has(element.dataset.value ?? '')
  ) {
    return true;
  }

  return (
    element.tagName === 'P' &&
    (
      element.classList.contains('editor-editable-markdown-blank-line') ||
      (
        element.classList.contains('editor-empty-paragraph') &&
        !element.classList.contains('is-editor-empty')
      )
    )
  );
}

function canMirrorMarkdownBlankLineLayout(sourceElement: HTMLElement, previewElement: HTMLElement): boolean {
  if (!isMarkdownBlankLineElement(sourceElement)) {
    return false;
  }

  if (sourceElement.dataset.type === 'html-block') {
    return previewElement.dataset.type === 'html-block';
  }

  return previewElement.tagName === 'P';
}

export function stabilizePreviewBlankLineLayout(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
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
    if (!previewElement || !canMirrorMarkdownBlankLineLayout(sourceElement, previewElement)) {
      return;
    }

    copyAllowedClasses(sourceElement, previewElement, MARKDOWN_BLANK_LINE_CLASS_NAMES);
    if (sourceElement.dataset.type === 'html-block') {
      previewElement.dataset.value = sourceElement.dataset.value ?? MARKDOWN_BLANK_LINE_VALUE;
    }
    mirrorLayoutStyles(sourceElement, previewElement, MARKDOWN_BLANK_LINE_STYLE_PROPS);
  });
}
