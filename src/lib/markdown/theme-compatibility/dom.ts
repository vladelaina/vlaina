import type { MarkdownThemePlatform } from './types';

export const MARKDOWN_THEME_ROOT_ATTRIBUTE = 'data-markdown-theme-root';
export const MARKDOWN_THEME_PLATFORM_ATTRIBUTE = 'data-markdown-theme-platform';
export const MARKDOWN_IMPORTED_THEME_ATTRIBUTE = 'data-markdown-imported-theme';
export const IMPORTED_MARKDOWN_THEME_STYLE_ATTRIBUTE = 'data-vlaina-imported-markdown-theme';
export const IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_ATTRIBUTE = 'data-vlaina-imported-markdown-theme-post-bridge';
export const IMPORTED_APP_THEME_STYLE_ATTRIBUTE = 'data-vlaina-imported-app-theme';
export const IMPORTED_APP_THEME_PLATFORM_ATTRIBUTE = 'data-vlaina-imported-app-theme-platform';

export const MARKDOWN_THEME_ROOT_SELECTOR = `[${MARKDOWN_THEME_ROOT_ATTRIBUTE}="true"]`;
export const IMPORTED_MARKDOWN_THEME_STYLE_SELECTOR = `style[${IMPORTED_MARKDOWN_THEME_STYLE_ATTRIBUTE}="true"]`;
export const IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_SELECTOR = `style[${IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_ATTRIBUTE}="true"]`;
export const IMPORTED_APP_THEME_STYLE_SELECTOR = `style[${IMPORTED_APP_THEME_STYLE_ATTRIBUTE}="true"]`;

export function getMarkdownThemePlatformSelector(platform: MarkdownThemePlatform | string): string {
  return `[${MARKDOWN_THEME_PLATFORM_ATTRIBUTE}="${platform}"]`;
}

export function getMarkdownThemeRootScopeSelector(platform: MarkdownThemePlatform | string): string {
  return `${MARKDOWN_THEME_ROOT_SELECTOR}${getMarkdownThemePlatformSelector(platform)}`;
}

export function getImportedMarkdownThemeScopeSelector(
  id: string
): string {
  return [
    MARKDOWN_THEME_ROOT_SELECTOR,
    `[${MARKDOWN_IMPORTED_THEME_ATTRIBUTE}="${id}"]`,
  ].join('');
}

export function getImportedThemeStyleElementId(id: string): string {
  return `vlaina-imported-markdown-theme-${id}`;
}

export function getImportedThemePostBridgeStyleElementId(id: string): string {
  return `vlaina-imported-markdown-theme-post-bridge-${id}`;
}

export function getImportedAppThemeStyleElementId(id: string): string {
  return `vlaina-imported-app-theme-${id}`;
}
