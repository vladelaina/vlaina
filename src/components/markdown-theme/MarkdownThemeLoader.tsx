import { useEffect } from 'react';
import {
  readImportedMarkdownTheme,
} from '@/lib/markdown/theme-compatibility/importedThemeStorage';
import {
  getImportedAppThemeStyleElementId,
  getImportedMarkdownThemeScopeSelector,
  getImportedThemePostBridgeStyleElementId,
  getImportedThemeStyleElementId,
  IMPORTED_APP_THEME_STYLE_ATTRIBUTE,
  IMPORTED_APP_THEME_STYLE_SELECTOR,
  IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_ATTRIBUTE,
  IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_SELECTOR,
  IMPORTED_MARKDOWN_THEME_STYLE_ATTRIBUTE,
  IMPORTED_MARKDOWN_THEME_STYLE_SELECTOR,
} from '@/lib/markdown/theme-compatibility/dom';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import {
  selectMarkdownImportedThemeId,
} from '@/stores/unified/settings/markdownSettings';

function removeImportedThemeStyles() {
  for (const element of Array.from(document.querySelectorAll(IMPORTED_MARKDOWN_THEME_STYLE_SELECTOR))) {
    element.remove();
  }
  for (const element of Array.from(document.querySelectorAll(IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_SELECTOR))) {
    element.remove();
  }
  for (const element of Array.from(document.querySelectorAll(IMPORTED_APP_THEME_STYLE_SELECTOR))) {
    element.remove();
  }
  document.documentElement.removeAttribute('data-vlaina-imported-app-theme');
}

function upsertImportedThemeStyle(id: string, css: string) {
  const styleId = getImportedThemeStyleElementId(id);
  const existing = document.getElementById(styleId);
  const element = existing instanceof HTMLStyleElement ? existing : document.createElement('style');
  element.id = styleId;
  element.setAttribute(IMPORTED_MARKDOWN_THEME_STYLE_ATTRIBUTE, 'true');
  element.textContent = css;

  if (!existing) {
    document.head.appendChild(element);
  }

  for (const other of Array.from(document.querySelectorAll<HTMLStyleElement>(IMPORTED_MARKDOWN_THEME_STYLE_SELECTOR))) {
    if (other.id !== styleId) {
      other.remove();
    }
  }
}

function upsertImportedThemePostBridgeStyle(id: string, css: string) {
  const styleId = getImportedThemePostBridgeStyleElementId(id);

  if (!css.trim()) {
    for (const element of Array.from(document.querySelectorAll(IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_SELECTOR))) {
      element.remove();
    }
    return;
  }

  const existing = document.getElementById(styleId);
  const element = existing instanceof HTMLStyleElement ? existing : document.createElement('style');
  element.id = styleId;
  element.setAttribute(IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_ATTRIBUTE, 'true');
  element.textContent = css;

  if (!existing) {
    document.head.appendChild(element);
  }

  for (const other of Array.from(document.querySelectorAll<HTMLStyleElement>(IMPORTED_MARKDOWN_THEME_POST_BRIDGE_STYLE_SELECTOR))) {
    if (other.id !== styleId) {
      other.remove();
    }
  }
}

function upsertImportedAppThemeStyle(id: string, css: string) {
  document.documentElement.setAttribute('data-vlaina-imported-app-theme', id);

  if (!css.trim()) {
    for (const element of Array.from(document.querySelectorAll(IMPORTED_APP_THEME_STYLE_SELECTOR))) {
      element.remove();
    }
    return;
  }

  const styleId = getImportedAppThemeStyleElementId(id);
  const existing = document.getElementById(styleId);
  const element = existing instanceof HTMLStyleElement ? existing : document.createElement('style');
  element.id = styleId;
  element.setAttribute(IMPORTED_APP_THEME_STYLE_ATTRIBUTE, 'true');
  element.textContent = css;

  if (!existing) {
    document.head.appendChild(element);
  }

  for (const other of Array.from(document.querySelectorAll<HTMLStyleElement>(IMPORTED_APP_THEME_STYLE_SELECTOR))) {
    if (other.id !== styleId) {
      other.remove();
    }
  }
}

export function MarkdownThemeLoader() {
  const importedThemeId = useUnifiedStore(selectMarkdownImportedThemeId);
  const setMarkdownImportedThemeId = useUnifiedStore((state) => state.setMarkdownImportedThemeId);

  useEffect(() => {
    let cancelled = false;

    if (!importedThemeId) {
      removeImportedThemeStyles();
      return () => {
        cancelled = true;
      };
    }

    removeImportedThemeStyles();

    void Promise.all([
      readImportedMarkdownTheme(importedThemeId),
      import('@/lib/markdown/theme-compatibility/cssScoping'),
      import('@/lib/markdown/theme-compatibility/cssUrls'),
      import('@/lib/markdown/theme-compatibility/appThemeBridge'),
      import('@/lib/markdown/theme-compatibility/postBridge'),
    ]).then(([theme, { scopeImportedMarkdownThemeCss }, { sanitizeImportedMarkdownThemeCss }, { buildImportedAppThemeCss }, { buildImportedMarkdownThemePostBridgeCss }]) => {
      if (cancelled) return;
      if (!theme) {
        removeImportedThemeStyles();
        setMarkdownImportedThemeId(null);
        return;
      }

      upsertImportedThemeStyle(
        theme.id,
        scopeImportedMarkdownThemeCss(
          sanitizeImportedMarkdownThemeCss(theme.css),
          theme.platform,
          getImportedMarkdownThemeScopeSelector(theme.id)
        )
      );
      upsertImportedAppThemeStyle(
        theme.id,
        buildImportedAppThemeCss(sanitizeImportedMarkdownThemeCss(theme.css), theme.id)
      );
      upsertImportedThemePostBridgeStyle(
        theme.id,
        buildImportedMarkdownThemePostBridgeCss(theme.id, theme.platform)
      );
    }).catch(() => {
      if (!cancelled) {
        removeImportedThemeStyles();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [importedThemeId, setMarkdownImportedThemeId]);

  return null;
}
