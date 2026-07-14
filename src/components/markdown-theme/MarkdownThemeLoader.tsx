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
import { useEffectiveImportedMarkdownThemeId } from './markdownThemePreview';

export function MarkdownThemeLoader() {
  const importedThemeId = useUnifiedStore(selectMarkdownImportedThemeId);
  const effectiveThemeId = useEffectiveImportedMarkdownThemeId(importedThemeId);
  const setMarkdownImportedThemeId = useUnifiedStore((state) => state.setMarkdownImportedThemeId);

  useEffect(() => {
    let cancelled = false;

    if (!effectiveThemeId) {
      removeImportedThemeStyles();
      return () => {
        cancelled = true;
      };
    }

    preloadMarkdownThemeCompiler();

    void readImportedMarkdownTheme(effectiveThemeId).then(async (theme) => {
      if (cancelled) return;
      if (!theme) {
        removeImportedThemeStyles();
        if (effectiveThemeId === importedThemeId) {
          setMarkdownImportedThemeId(null);
        }
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
        compiled.platform,
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
  }, [effectiveThemeId, importedThemeId, setMarkdownImportedThemeId]);

  return null;
}
