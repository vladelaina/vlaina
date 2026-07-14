import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { useImportedMarkdownThemePlatform } from '@/components/markdown-theme/useImportedMarkdownThemePlatform';
import { normalizeColorModePreference } from '@/lib/theme/colorModeSync';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import {
  selectMarkdownImportedThemeId,
  selectMarkdownTypewriterModeEnabled,
} from '@/stores/unified/settings/markdownSettings';
import {
  applyMarkdownThemeRuntimeAttributes,
  resolveMarkdownThemeRuntimeColorScheme,
  resolveMarkdownThemeViewport,
  resolveTyporaRuntimePlatformClasses,
} from './markdownThemeRuntime';

export function useMilkdownThemeRuntime(args: {
  activatedRevision: number;
  editorShellRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const { activatedRevision, editorShellRef } = args;
  const importedMarkdownThemeId = useUnifiedStore(selectMarkdownImportedThemeId);
  const typewriterMode = useUnifiedStore(selectMarkdownTypewriterModeEnabled);
  const appColorModePreference = useUnifiedStore((state) => state.data.settings.ui?.colorMode);
  const { resolvedTheme } = useTheme();
  const normalizedAppColorMode = normalizeColorModePreference(appColorModePreference);
  const appMarkdownThemeColorScheme = normalizedAppColorMode === 'system'
    ? (resolvedTheme === 'dark' ? 'dark' : 'light')
    : normalizedAppColorMode;
  const importedMarkdownThemePlatform = useImportedMarkdownThemePlatform(importedMarkdownThemeId);
  const [markdownThemeViewport, setMarkdownThemeViewport] = useState(() =>
    resolveMarkdownThemeViewport(typeof window === 'undefined' ? 1024 : window.innerWidth)
  );

  const typoraRuntimePlatformClasses = useMemo(() => {
    return importedMarkdownThemePlatform === 'typora'
      ? resolveTyporaRuntimePlatformClasses().join(' ')
      : '';
  }, [importedMarkdownThemePlatform]);

  const markdownThemeRuntimeColorScheme = useMemo(() => {
    return resolveMarkdownThemeRuntimeColorScheme({
      importedThemeId: importedMarkdownThemeId,
      importedThemePlatform: importedMarkdownThemePlatform,
      appColorScheme: appMarkdownThemeColorScheme,
    });
  }, [
    appMarkdownThemeColorScheme,
    importedMarkdownThemeId,
    importedMarkdownThemePlatform,
  ]);

  useEffect(() => {
    const updateViewport = () => {
      setMarkdownThemeViewport(resolveMarkdownThemeViewport(window.innerWidth));
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useLayoutEffect(() => {
    const shell = editorShellRef.current;
    if (!shell) return;

    const applyRuntimeAttributes = () => {
      const root = shell.querySelector<HTMLElement>('#write, .ProseMirror');
      for (const element of [shell, root].filter((element): element is HTMLElement => Boolean(element))) {
        applyMarkdownThemeRuntimeAttributes(element, {
          importedThemeId: importedMarkdownThemeId,
          importedThemePlatform: importedMarkdownThemePlatform,
          colorScheme: markdownThemeRuntimeColorScheme.colorScheme,
          colorSchemeMode: markdownThemeRuntimeColorScheme.mode,
          viewport: markdownThemeViewport,
          typewriterMode,
        });
      }
      return Boolean(root);
    };

    const observer = new MutationObserver(() => {
      if (applyRuntimeAttributes()) {
        observer.disconnect();
      }
    });
    observer.observe(shell, { childList: true, subtree: true });
    if (applyRuntimeAttributes()) {
      observer.disconnect();
    }
    return () => observer.disconnect();
  }, [
    activatedRevision,
    editorShellRef,
    importedMarkdownThemeId,
    importedMarkdownThemePlatform,
    markdownThemeRuntimeColorScheme,
    markdownThemeViewport,
    typewriterMode,
  ]);

  return {
    importedMarkdownThemeId,
    importedMarkdownThemePlatform,
    markdownThemeRuntimeColorScheme,
    markdownThemeViewport,
    typewriterMode,
    typoraRuntimePlatformClasses,
  };
}
