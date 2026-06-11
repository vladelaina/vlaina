export const MARKDOWN_FONT_SIZE_STYLE_ID = 'vlaina-markdown-font-size-style';

const MARKDOWN_FONT_SIZE_SELECTOR =
  ':where(.markdown-surface, [data-vlaina-markdown-font-size-surface="true"])';

function getMarkdownFontSizeStyleElement(ownerDocument: Document): HTMLStyleElement {
  const existing = ownerDocument.getElementById(MARKDOWN_FONT_SIZE_STYLE_ID);
  if (existing instanceof HTMLStyleElement) {
    return existing;
  }

  const styleElement = ownerDocument.createElement('style');
  styleElement.id = MARKDOWN_FONT_SIZE_STYLE_ID;
  ownerDocument.head.appendChild(styleElement);
  return styleElement;
}

export function applyMarkdownFontSize(fontSize: number, ownerDocument?: Document): void {
  const doc = ownerDocument ?? (typeof document === 'undefined' ? null : document);
  if (!doc || !Number.isFinite(fontSize)) return;

  const fontSizePx = `${Math.round(fontSize)}px`;
  const styleElement = getMarkdownFontSizeStyleElement(doc);
  const rootStyle = doc.documentElement.style;
  const hasLegacyRootFontSize = rootStyle.getPropertyValue('--vlaina-markdown-font-size') !== '';
  if (styleElement.dataset.fontSizePx === fontSizePx && !hasLegacyRootFontSize) return;

  if (hasLegacyRootFontSize) {
    rootStyle.removeProperty('--vlaina-markdown-font-size');
  }
  if (styleElement.dataset.fontSizePx === fontSizePx) return;

  styleElement.dataset.fontSizePx = fontSizePx;
  styleElement.textContent = `${MARKDOWN_FONT_SIZE_SELECTOR} { --vlaina-markdown-font-size: ${fontSizePx}; }`;
}
