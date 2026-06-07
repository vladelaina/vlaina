import postcss from 'postcss';
import { findTopLevelBoundary, splitSelectorList } from '../cssScoping/selectorList';
import type { CollectedThemeCustomProperties, ThemeColorSchemeBucket } from './types';

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
  const mediaBucket = getAncestorMediaColorScheme(rule);
  if (mediaBucket === 'skip') return [];

  const buckets = new Set<ThemeColorSchemeBucket>();

  for (const selector of splitSelectorList(rule.selector)) {
    if (!isThemeShellRule(selector)) continue;
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

export function collectThemeCustomProperties(css: string): CollectedThemeCustomProperties {
  const root = postcss.parse(css, { from: undefined });
  const base = new Map<string, string>();
  const dark = new Map<string, string>();
  const light = new Map<string, string>();

  root.walkRules((rule) => {
    const buckets = getRuleColorSchemeBuckets(rule);
    if (buckets.length === 0) return;

    rule.walkDecls((declaration) => {
      if (!declaration.prop.startsWith('--')) return;
      if (!isSafeAppThemeCustomPropertyValue(declaration.value)) return;
      for (const bucket of buckets) {
        const target = bucket === 'dark' ? dark : bucket === 'light' ? light : base;
        target.set(declaration.prop, declaration.value);
      }
    });
  });

  return { base, dark, light };
}
