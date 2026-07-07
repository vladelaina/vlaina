import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { cn } from '@/lib/utils';

export function getMilkdownEditorClassName(args: {
  importedMarkdownThemeId: string | null | undefined;
  importedMarkdownThemePlatform: string | null | undefined;
  markdownThemeColorScheme: string;
  markdownThemeViewport: string;
  showBodyLineNumbers: boolean;
  typewriterMode: boolean;
  typoraRuntimePlatformClasses: string;
}) {
  const {
    importedMarkdownThemeId,
    importedMarkdownThemePlatform,
    markdownThemeColorScheme,
    markdownThemeViewport,
    showBodyLineNumbers,
    typewriterMode,
    typoraRuntimePlatformClasses,
  } = args;

  return cn(
    "milkdown-editor",
    showBodyLineNumbers && 'markdown-body-line-numbers',
    !importedMarkdownThemeId && 'theme-vlaina',
    importedMarkdownThemeId && 'theme-external-markdown',
    importedMarkdownThemePlatform === 'typora' && 'theme-typora typora-export typora-export-content typora-node',
    typoraRuntimePlatformClasses,
    importedMarkdownThemePlatform === 'obsidian' && 'theme-obsidian',
    markdownThemeColorScheme === 'dark' && 'theme-dark',
    markdownThemeColorScheme === 'light' && 'theme-light',
    'is-live-preview',
    'max',
    'is-readable-line-width',
    markdownThemeViewport === 'mobile' && 'is-mobile',
    markdownThemeViewport === 'tablet' && 'is-tablet',
    markdownThemeViewport === 'desktop' && 'is-desktop',
    typewriterMode && 'ty-on-typewriter-mode',
    EDITOR_LAYOUT_CLASS
  );
}
