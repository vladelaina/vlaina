import postcss from 'postcss';
import { isKeyframesRule } from './cssRules';
import { addRootStateClassToSelectorList } from './selectorScoping';
import { splitSelectorList } from './selectorList';

export function rewriteColorSchemeMediaQueries(root: postcss.Root, scopeSelector: string): void {
  root.walkAtRules('media', (atRule) => {
    const colorScheme = getMediaColorScheme(atRule.params);
    if (!colorScheme) return;

    const colorSchemeClass = colorScheme === 'dark' ? '.theme-dark' : '.theme-light';
    atRule.walkRules((rule) => {
      if (isKeyframesRule(rule)) return;
      rule.selector = addRootStateClassToSelectorList(rule.selector, scopeSelector, colorSchemeClass);
    });

    const remainingParams = removeMediaColorScheme(atRule.params);
    if (remainingParams) {
      atRule.params = remainingParams;
      return;
    }

    const parent = atRule.parent;
    if (!parent) return;
    const nodes = atRule.nodes ?? [];
    atRule.replaceWith(...nodes);
  });
}

function getMediaColorScheme(params: string): 'dark' | 'light' | null {
  const hasDark = /prefers-color-scheme\s*:\s*dark/i.test(params);
  const hasLight = /prefers-color-scheme\s*:\s*light/i.test(params);
  if (hasDark === hasLight) return null;
  return hasDark ? 'dark' : 'light';
}

function removeMediaColorScheme(params: string): string {
  const parts = splitSelectorList(params)
    .map(removeMediaColorSchemePart)
    .filter(Boolean);

  return parts.join(', ');
}

function removeMediaColorSchemePart(part: string): string {
  return part
    .replace(/\s+and\s+\(\s*prefers-color-scheme\s*:\s*(?:dark|light)\s*\)/gi, '')
    .replace(/\(\s*prefers-color-scheme\s*:\s*(?:dark|light)\s*\)\s+and\s+/gi, '')
    .replace(/\(\s*prefers-color-scheme\s*:\s*(?:dark|light)\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+and\s*$/i, '')
    .replace(/^and\s+/i, '')
    .trim();
}
