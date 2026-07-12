import postcss from 'postcss';
import { findTopLevelBoundary, splitSelectorList } from '../cssScoping/selectorList';
import {
  isSafeAppThemeBackgroundLayer,
  isSafeAppThemeBackgroundLayerValue,
  isSafeAppThemeCustomPropertyValue,
  isShellOnlyBackgroundValue,
} from './backgroundValueSafety';
import type { CollectedThemeCustomProperties, ThemeColorSchemeBucket } from './types';
import {
  isTyporaDocumentBackgroundImageProperty,
  isTyporaDocumentBackgroundRule,
} from '../typora/appTheme/selectors';

const IMPORTED_APP_BACKGROUND_PROPERTY = '--vlaina-imported-app-background';
const IMPORTED_APP_BACKGROUND_ATTACHMENT_PROPERTY = '--vlaina-imported-app-background-attachment';
const IMPORTED_APP_BACKGROUND_CLIP_PROPERTY = '--vlaina-imported-app-background-clip';
const IMPORTED_APP_DOCUMENT_BACKGROUND_IMAGE_PROPERTY = '--vlaina-imported-app-document-background-image';
const IMPORTED_APP_BACKGROUND_LAYER_PROPERTY = '--vlaina-imported-app-background-layer';
const IMPORTED_APP_BACKGROUND_ORIGIN_PROPERTY = '--vlaina-imported-app-background-origin';
const IMPORTED_APP_BACKGROUND_POSITION_PROPERTY = '--vlaina-imported-app-background-position';
const IMPORTED_APP_BACKGROUND_REPEAT_PROPERTY = '--vlaina-imported-app-background-repeat';
const IMPORTED_APP_BACKGROUND_SIZE_PROPERTY = '--vlaina-imported-app-background-size';

function isThemeShellRule(selector: string): boolean {
  const normalized = selector.trim();
  if (!normalized || findTopLevelBoundary(normalized, 0) >= 0) {
    return false;
  }

  return /^(?::root|html|body)(?=$|[.#:[)])/i.test(normalized)
    || /^\.(?:theme-(?:dark|light)|dark|light)(?=$|[.#:[)])/i.test(normalized);
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

export function collectThemeCustomProperties(css: string): CollectedThemeCustomProperties {
  const base = new Map<string, string>();
  const dark = new Map<string, string>();
  const light = new Map<string, string>();
  let root: postcss.Root;
  try {
    root = postcss.parse(css, { from: undefined });
  } catch {
    return { base, dark, light };
  }

  root.walkRules((rule) => {
    const customPropertyBuckets = getRuleColorSchemeBuckets(rule);
    const appBackgroundBuckets = getRuleAppBackgroundBuckets(rule);
    if (customPropertyBuckets.length === 0 && appBackgroundBuckets.length === 0) return;

    rule.walkDecls((declaration) => {
      if (declaration.prop.startsWith('--')) {
        for (const bucket of customPropertyBuckets) {
          const target = bucket === 'dark' ? dark : bucket === 'light' ? light : base;
          const isTyporaDocumentBackgroundImage = isTyporaDocumentBackgroundImageProperty(declaration.prop);
          if (
            !isSafeAppThemeCustomPropertyValue(declaration.value)
            && !(isTyporaDocumentBackgroundImage && isSafeAppThemeBackgroundLayerValue(declaration.value))
          ) {
            continue;
          }
          target.set(declaration.prop, declaration.value);
          if (declaration.prop === '--d-bi') {
            target.set(IMPORTED_APP_DOCUMENT_BACKGROUND_IMAGE_PROPERTY, `var(${declaration.prop})`);
          }
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
