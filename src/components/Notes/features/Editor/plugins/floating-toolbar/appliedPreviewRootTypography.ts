const ROOT_TYPOGRAPHY_STYLE_PROPS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'wordSpacing',
  'whiteSpace',
] as const;

export function stabilizePreviewRootTypography(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom || typeof window === 'undefined') {
    return;
  }

  const computed = window.getComputedStyle(sourceDom);
  ROOT_TYPOGRAPHY_STYLE_PROPS.forEach((prop) => {
    const value = computed[prop];
    if (value) {
      previewDom.style[prop] = value;
    }
  });
}
