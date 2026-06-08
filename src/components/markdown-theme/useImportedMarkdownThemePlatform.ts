import { useEffect, useState } from 'react';
import {
  readImportedMarkdownThemeMetadata,
} from '@/lib/markdown/theme-compatibility/importedThemeStorage';
import type { MarkdownThemePlatform } from '@/lib/markdown/theme-compatibility/types';

interface ImportedMarkdownThemePlatformState {
  id: string | null;
  platform: MarkdownThemePlatform | null;
}

export function useImportedMarkdownThemePlatform(
  importedThemeId: string | null
): MarkdownThemePlatform | null {
  const [state, setState] = useState<ImportedMarkdownThemePlatformState>({
    id: null,
    platform: null,
  });

  useEffect(() => {
    let cancelled = false;

    if (!importedThemeId) {
      setState({ id: null, platform: null });
      return () => {
        cancelled = true;
      };
    }

    setState((current) =>
      current.id === importedThemeId ? current : { id: importedThemeId, platform: null }
    );

    void readImportedMarkdownThemeMetadata(importedThemeId).then((theme) => {
      if (!cancelled) {
        setState({ id: importedThemeId, platform: theme?.platform ?? null });
      }
    }).catch(() => {
      if (!cancelled) {
        setState({ id: importedThemeId, platform: null });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [importedThemeId]);

  return state.id === importedThemeId ? state.platform : null;
}
