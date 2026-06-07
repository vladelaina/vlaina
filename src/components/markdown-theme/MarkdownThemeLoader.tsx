import { useEffect } from 'react';
import {
  readImportedMarkdownTheme,
} from '@/lib/markdown/theme-compatibility/importedThemeStorage';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import {
  selectMarkdownImportedThemeId,
} from '@/stores/unified/settings/markdownSettings';
import {
  compileImportedMarkdownThemeStyles,
  preloadMarkdownThemeCompiler,
} from './markdownThemeCompiler';
import {
  removeImportedThemeStyles,
  upsertImportedAppThemeStyle,
  upsertImportedThemePostBridgeStyle,
  upsertImportedThemeStyle,
} from './markdownThemeStyleElements';

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

    preloadMarkdownThemeCompiler();

    void readImportedMarkdownTheme(importedThemeId).then(async (theme) => {
      if (cancelled) return;
      if (!theme) {
        removeImportedThemeStyles();
        setMarkdownImportedThemeId(null);
        return;
      }

      const compiled = await compileImportedMarkdownThemeStyles(theme);
      if (cancelled) return;

      upsertImportedThemeStyle(
        compiled.id,
        compiled.markdownCss
      );
      upsertImportedAppThemeStyle(
        compiled.id,
        compiled.appCss
      );
      upsertImportedThemePostBridgeStyle(
        compiled.id,
        compiled.postBridgeCss
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
