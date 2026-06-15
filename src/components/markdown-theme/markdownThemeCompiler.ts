import {
  getImportedMarkdownThemeScopeSelector,
} from '@/lib/markdown/theme-compatibility/dom';
import {
  readImportedMarkdownTheme,
} from '@/lib/markdown/theme-compatibility/importedThemeStorage';
import type { ImportedMarkdownTheme } from '@/lib/markdown/theme-compatibility/types';

interface MarkdownThemeCompilerModules {
  scopeImportedMarkdownThemeCss: typeof import('@/lib/markdown/theme-compatibility/cssScoping').scopeImportedMarkdownThemeCss;
  sanitizeImportedMarkdownThemeCss: typeof import('@/lib/markdown/theme-compatibility/cssUrls').sanitizeImportedMarkdownThemeCss;
  buildImportedAppThemeCss: typeof import('@/lib/markdown/theme-compatibility/appThemeBridge').buildImportedAppThemeCss;
  buildImportedMarkdownThemePostBridgeCss: typeof import('@/lib/markdown/theme-compatibility/postBridge').buildImportedMarkdownThemePostBridgeCss;
}

export interface CompiledImportedMarkdownThemeStyles {
  id: string;
  markdownCss: string;
  appCss: string;
  postBridgeCss: string;
}

const MAX_COMPILED_THEME_CACHE_ENTRIES = 8;

let compilerModulesPromise: Promise<MarkdownThemeCompilerModules> | null = null;
const compiledThemeCache = new Map<string, CompiledImportedMarkdownThemeStyles>();
const inFlightCompilations = new Map<string, Promise<CompiledImportedMarkdownThemeStyles>>();
const inFlightThemePreloads = new Map<string, Promise<void>>();

function loadMarkdownThemeCompilerModules(): Promise<MarkdownThemeCompilerModules> {
  compilerModulesPromise ??= Promise.all([
    import('@/lib/markdown/theme-compatibility/cssScoping'),
    import('@/lib/markdown/theme-compatibility/cssUrls'),
    import('@/lib/markdown/theme-compatibility/appThemeBridge'),
    import('@/lib/markdown/theme-compatibility/postBridge'),
  ]).then(([
    { scopeImportedMarkdownThemeCss },
    { sanitizeImportedMarkdownThemeCss },
    { buildImportedAppThemeCss },
    { buildImportedMarkdownThemePostBridgeCss },
  ]) => ({
    scopeImportedMarkdownThemeCss,
    sanitizeImportedMarkdownThemeCss,
    buildImportedAppThemeCss,
    buildImportedMarkdownThemePostBridgeCss,
  })).catch((error) => {
    compilerModulesPromise = null;
    throw error;
  });

  return compilerModulesPromise;
}

function getCompiledThemeCacheKey(theme: ImportedMarkdownTheme): string {
  return [
    theme.id,
    theme.platform,
    theme.updatedAt,
    theme.css.length,
    hashString(theme.css),
  ].join(':');
}

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function rememberCompiledTheme(
  key: string,
  compiled: CompiledImportedMarkdownThemeStyles
): CompiledImportedMarkdownThemeStyles {
  compiledThemeCache.delete(key);
  compiledThemeCache.set(key, compiled);

  while (compiledThemeCache.size > MAX_COMPILED_THEME_CACHE_ENTRIES) {
    const oldestKey = compiledThemeCache.keys().next().value;
    if (!oldestKey) break;
    compiledThemeCache.delete(oldestKey);
  }

  return compiled;
}

export function preloadMarkdownThemeCompiler(): Promise<void> {
  return loadMarkdownThemeCompilerModules()
    .then(() => undefined)
    .catch(() => undefined);
}

export function preloadCompiledImportedMarkdownThemeStyles(id: string): void {
  if (inFlightThemePreloads.has(id)) {
    return;
  }

  const preload = readImportedMarkdownTheme(id)
    .then((theme) => {
      if (!theme) return;
      return compileImportedMarkdownThemeStyles(theme).then(() => undefined);
    })
    .catch(() => undefined)
    .finally(() => {
      inFlightThemePreloads.delete(id);
    });

  inFlightThemePreloads.set(id, preload);
}

export function clearCompiledImportedMarkdownThemeStyles(): void {
  compiledThemeCache.clear();
  inFlightCompilations.clear();
  inFlightThemePreloads.clear();
}

export async function compileImportedMarkdownThemeStyles(
  theme: ImportedMarkdownTheme
): Promise<CompiledImportedMarkdownThemeStyles> {
  const cacheKey = getCompiledThemeCacheKey(theme);
  const cached = compiledThemeCache.get(cacheKey);
  if (cached) {
    compiledThemeCache.delete(cacheKey);
    compiledThemeCache.set(cacheKey, cached);
    return cached;
  }

  const inFlight = inFlightCompilations.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const compilation = loadMarkdownThemeCompilerModules().then(({
    scopeImportedMarkdownThemeCss,
    sanitizeImportedMarkdownThemeCss,
    buildImportedAppThemeCss,
    buildImportedMarkdownThemePostBridgeCss,
  }) => {
    const sanitizedCss = sanitizeImportedMarkdownThemeCss(theme.css);
    return rememberCompiledTheme(cacheKey, {
      id: theme.id,
      markdownCss: scopeImportedMarkdownThemeCss(
        sanitizedCss,
        theme.platform,
        getImportedMarkdownThemeScopeSelector(theme.id)
      ),
      appCss: buildImportedAppThemeCss(sanitizedCss, theme.id),
      postBridgeCss: buildImportedMarkdownThemePostBridgeCss(theme.id, theme.platform),
    });
  }).finally(() => {
    inFlightCompilations.delete(cacheKey);
  });

  inFlightCompilations.set(cacheKey, compilation);
  return compilation;
}
