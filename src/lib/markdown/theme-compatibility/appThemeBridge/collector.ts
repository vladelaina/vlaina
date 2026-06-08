import postcss from 'postcss';
import { findTopLevelBoundary, splitSelectorList } from '../cssScoping/selectorList';
import type { CollectedThemeCustomProperties, ThemeColorSchemeBucket } from './types';

const IMPORTED_APP_BACKGROUND_PROPERTY = '--vlaina-imported-app-background';
const IMPORTED_APP_BACKGROUND_ATTACHMENT_PROPERTY = '--vlaina-imported-app-background-attachment';
const IMPORTED_APP_BACKGROUND_CLIP_PROPERTY = '--vlaina-imported-app-background-clip';
const IMPORTED_APP_BACKGROUND_LAYER_PROPERTY = '--vlaina-imported-app-background-layer';
const IMPORTED_APP_BACKGROUND_ORIGIN_PROPERTY = '--vlaina-imported-app-background-origin';
const IMPORTED_APP_BACKGROUND_POSITION_PROPERTY = '--vlaina-imported-app-background-position';
const IMPORTED_APP_BACKGROUND_REPEAT_PROPERTY = '--vlaina-imported-app-background-repeat';
const IMPORTED_APP_BACKGROUND_SIZE_PROPERTY = '--vlaina-imported-app-background-size';
const NON_COLOR_BACKGROUND_KEYWORDS = new Set([
  'border-box',
  'bottom',
  'center',
  'contain',
  'content-box',
  'cover',
  'fixed',
  'left',
  'local',
  'no-repeat',
  'padding-box',
  'repeat',
  'repeat-x',
  'repeat-y',
  'right',
  'scroll',
  'top',
]);

function isThemeShellRule(selector: string): boolean {
  const normalized = selector.trim();
  if (!normalized || findTopLevelBoundary(normalized, 0) >= 0) {
    return false;
  }

  return /^(?::root|html|body)(?=$|[.#:[)])/i.test(normalized)
    || /^\.(?:theme-(?:dark|light)|dark|light)(?=$|[.#:[)])/i.test(normalized);
}

function isTyporaDocumentBackgroundRule(selector: string): boolean {
  const normalized = selector.trim().replace(/\s+/g, ' ');
  if (!normalized) return false;

  return /^(?:body\.typora-export|\.typora-export(?:\s+|>)#write|content\s*>\s*#write)(?=$|[.#:[\s>+~])/i.test(normalized)
    || /^(?:\.typora-export\s+)?#write(?::not\([^)]*\))?(?:::before|::after|:before|:after)$/i.test(normalized)
    || /^\.v-welcome-page(?=$|[.#:[\s>+~])/i.test(normalized);
}

function isDarkThemeRule(selector: string): boolean {
  return /\.theme-dark\b|(?:^|[\s,])(?:html|body)?\.dark\b/i.test(selector);
}

function isLightThemeRule(selector: string): boolean {
  return /\.theme-light\b|(?:^|[\s,])(?:html|body)?\.light\b/i.test(selector);
}

function getAncestorMediaColorScheme(rule: postcss.Rule): ThemeColorSchemeBucket | 'skip' | null {
  let parent = rule.parent as postcss.AnyNode | undefined;
  while (parent) {
    if (parent.type === 'atrule' && parent.name.toLowerCase() === 'media') {
      const params = parent.params.toLowerCase();
      if (/\bprint\b/.test(params)) {
        return 'skip';
      }
      if (/prefers-color-scheme\s*:\s*dark/.test(params)) {
        return 'dark';
      }
      if (/prefers-color-scheme\s*:\s*light/.test(params)) {
        return 'light';
      }
    }
    parent = parent.parent as postcss.AnyNode | undefined;
  }

  return null;
}

function getRuleColorSchemeBuckets(rule: postcss.Rule): ThemeColorSchemeBucket[] {
  return getRuleBuckets(rule, isThemeShellRule);
}

function getRuleAppBackgroundBuckets(rule: postcss.Rule): ThemeColorSchemeBucket[] {
  return getRuleBuckets(
    rule,
    (selector) => isThemeShellRule(selector) || isTyporaDocumentBackgroundRule(selector)
  );
}

function getRuleBuckets(
  rule: postcss.Rule,
  selectorMatcher: (selector: string) => boolean
): ThemeColorSchemeBucket[] {
  const mediaBucket = getAncestorMediaColorScheme(rule);
  if (mediaBucket === 'skip') return [];

  const buckets = new Set<ThemeColorSchemeBucket>();

  for (const selector of splitSelectorList(rule.selector)) {
    if (!selectorMatcher(selector)) continue;
    if (isDarkThemeRule(selector)) {
      buckets.add('dark');
      continue;
    }
    if (isLightThemeRule(selector)) {
      buckets.add('light');
      continue;
    }
    buckets.add(mediaBucket ?? 'base');
  }

  return Array.from(buckets);
}

function isSafeAppThemeCustomPropertyValue(value: string): boolean {
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  if (normalized.includes('javascript:') || normalized.includes('vbscript:')) {
    return false;
  }

  return !/url\(/i.test(value);
}

function isSafeAppThemeBackgroundLayerValue(value: string): boolean {
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  return !normalized.includes('javascript:') && !normalized.includes('vbscript:');
}

function isSafeAppThemeBackgroundValue(
  declaration: postcss.Declaration
): boolean {
  if (!isSafeAppThemeCustomPropertyValue(declaration.value)) {
    return false;
  }

  const property = declaration.prop.toLowerCase();
  if (property === 'background-color') {
    return isColorLikeCssValue(declaration.value);
  }

  if (property !== 'background') {
    return false;
  }

  const tokens = splitCssValueTokens(declaration.value);
  return tokens.length === 1 && isColorLikeCssValue(tokens[0]);
}

function isSafeAppThemeBackgroundLayer(
  declaration: postcss.Declaration
): boolean {
  const property = declaration.prop.toLowerCase();
  if (property !== 'background' && property !== 'background-color' && property !== 'background-image') {
    return false;
  }
  if (!isSafeAppThemeBackgroundLayerValue(declaration.value)) {
    return false;
  }

  const normalized = declaration.value.trim();
  return Boolean(normalized) && !/^(?:none|transparent|initial|inherit|unset|revert|revert-layer)$/i.test(normalized);
}

function getBackgroundLonghandBridgeProperty(property: string): string | null {
  switch (property.toLowerCase()) {
    case 'background-attachment':
      return IMPORTED_APP_BACKGROUND_ATTACHMENT_PROPERTY;
    case 'background-clip':
      return IMPORTED_APP_BACKGROUND_CLIP_PROPERTY;
    case 'background-origin':
      return IMPORTED_APP_BACKGROUND_ORIGIN_PROPERTY;
    case 'background-position':
      return IMPORTED_APP_BACKGROUND_POSITION_PROPERTY;
    case 'background-repeat':
      return IMPORTED_APP_BACKGROUND_REPEAT_PROPERTY;
    case 'background-size':
      return IMPORTED_APP_BACKGROUND_SIZE_PROPERTY;
    default:
      return null;
  }
}

function isShellOnlyBackgroundValue(
  declaration: postcss.Declaration
): boolean {
  return isSafeAppThemeBackgroundValue(declaration);
}

function isColorLikeCssValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (/^(?:none|transparent|initial|inherit|unset|revert|revert-layer)$/i.test(normalized)) {
    return false;
  }
  if (normalized.startsWith('#')) return true;
  if (/^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|var)\(/i.test(normalized)) {
    return true;
  }
  return /^[a-z]+$/i.test(normalized) && !NON_COLOR_BACKGROUND_KEYWORDS.has(normalized);
}

function splitCssValueTokens(value: string): string[] {
  const tokens: string[] = [];
  let start = 0;
  let quote: string | null = null;
  let parenDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      continue;
    }
    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (parenDepth === 0 && /\s/.test(char)) {
      const token = value.slice(start, index).trim();
      if (token) tokens.push(token);
      start = index + 1;
    }
  }

  const token = value.slice(start).trim();
  if (token) tokens.push(token);
  return tokens;
}

export function collectThemeCustomProperties(css: string): CollectedThemeCustomProperties {
  const root = postcss.parse(css, { from: undefined });
  const base = new Map<string, string>();
  const dark = new Map<string, string>();
  const light = new Map<string, string>();

  root.walkRules((rule) => {
    const customPropertyBuckets = getRuleColorSchemeBuckets(rule);
    const appBackgroundBuckets = getRuleAppBackgroundBuckets(rule);
    if (customPropertyBuckets.length === 0 && appBackgroundBuckets.length === 0) return;

    rule.walkDecls((declaration) => {
      if (declaration.prop.startsWith('--')) {
        for (const bucket of customPropertyBuckets) {
          const target = bucket === 'dark' ? dark : bucket === 'light' ? light : base;
          if (!isSafeAppThemeCustomPropertyValue(declaration.value)) continue;
          target.set(declaration.prop, declaration.value);
        }
        return;
      }

      for (const bucket of appBackgroundBuckets) {
        const target = bucket === 'dark' ? dark : bucket === 'light' ? light : base;
        if (isSafeAppThemeBackgroundLayer(declaration)) {
          target.set(IMPORTED_APP_BACKGROUND_LAYER_PROPERTY, declaration.value);
          continue;
        }

        const backgroundLonghandProperty = getBackgroundLonghandBridgeProperty(declaration.prop);
        if (
          backgroundLonghandProperty
          && isSafeAppThemeBackgroundLayerValue(declaration.value)
          && declaration.value.trim()
        ) {
          target.set(backgroundLonghandProperty, declaration.value);
        }
      }

      for (const bucket of customPropertyBuckets) {
        const target = bucket === 'dark' ? dark : bucket === 'light' ? light : base;
        if (isShellOnlyBackgroundValue(declaration)) {
          target.set(IMPORTED_APP_BACKGROUND_PROPERTY, declaration.value);
        }
      }
    });
  });

  return { base, dark, light };
}
