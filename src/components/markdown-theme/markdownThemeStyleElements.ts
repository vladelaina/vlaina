import {
  getImportedAppThemeStyleElementId,
  getImportedThemePostBridgeStyleElementId,
  getImportedThemeStyleElementId,
  IMPORTED_APP_THEME_STYLE_ATTRIBUTE,
  IMPORTED_APP_THEME_PLATFORM_ATTRIBUTE,
  IMPORTED_APP_THEME_STYLE_SELECTOR,
  IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_ATTRIBUTE,
  IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_SELECTOR,
  IMPORTED_MARKDOWN_THEME_STYLE_ATTRIBUTE,
  IMPORTED_MARKDOWN_THEME_STYLE_SELECTOR,
} from '@/lib/markdown/theme-compatibility/dom';
import type { MarkdownThemePlatform } from '@/lib/markdown/theme-compatibility/types';

function removeStyleElements(selector: string): void {
  for (const element of Array.from(document.querySelectorAll(selector))) {
    element.remove();
  }
}

function removeOtherStyleElements(selector: string, styleId: string): void {
  for (const other of Array.from(document.querySelectorAll<HTMLStyleElement>(selector))) {
    if (other.id !== styleId) {
      other.remove();
    }
  }
}

function upsertStyleElement({
  id,
  attribute,
  selector,
  css,
}: {
  id: string;
  attribute: string;
  selector: string;
  css: string;
}): void {
  const existing = document.getElementById(id);
  const element = existing instanceof HTMLStyleElement ? existing : document.createElement('style');
  element.id = id;
  element.setAttribute(attribute, 'true');
  element.textContent = css;

  if (!existing) {
    document.head.appendChild(element);
  }

  removeOtherStyleElements(selector, id);
}

export function removeImportedThemeStyles(): void {
  removeStyleElements(IMPORTED_MARKDOWN_THEME_STYLE_SELECTOR);
  removeStyleElements(IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_SELECTOR);
  removeStyleElements(IMPORTED_APP_THEME_STYLE_SELECTOR);
  document.documentElement.removeAttribute('data-vlaina-imported-app-theme');
  document.documentElement.removeAttribute(IMPORTED_APP_THEME_PLATFORM_ATTRIBUTE);
}

export function upsertImportedThemeStyle(id: string, css: string): void {
  upsertStyleElement({
    id: getImportedThemeStyleElementId(id),
    attribute: IMPORTED_MARKDOWN_THEME_STYLE_ATTRIBUTE,
    selector: IMPORTED_MARKDOWN_THEME_STYLE_SELECTOR,
    css,
  });
}

export function upsertImportedThemePostBridgeStyle(id: string, css: string): void {
  if (!css.trim()) {
    removeStyleElements(IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_SELECTOR);
    return;
  }

  upsertStyleElement({
    id: getImportedThemePostBridgeStyleElementId(id),
    attribute: IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_ATTRIBUTE,
    selector: IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_SELECTOR,
    css,
  });
}

export function upsertImportedAppThemeStyle(
  id: string,
  platform: MarkdownThemePlatform,
  css: string
): void {
  document.documentElement.setAttribute('data-vlaina-imported-app-theme', id);
  document.documentElement.setAttribute(IMPORTED_APP_THEME_PLATFORM_ATTRIBUTE, platform);

  if (!css.trim()) {
    removeStyleElements(IMPORTED_APP_THEME_STYLE_SELECTOR);
    return;
  }

  upsertStyleElement({
    id: getImportedAppThemeStyleElementId(id),
    attribute: IMPORTED_APP_THEME_STYLE_ATTRIBUTE,
    selector: IMPORTED_APP_THEME_STYLE_SELECTOR,
    css,
  });
}
