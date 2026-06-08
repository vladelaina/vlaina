import postcss from 'postcss';
import { getMarkdownThemeRootScopeSelector } from './dom';
import { isKeyframesRule } from './cssScoping/cssRules';
import {
  resolveFixedLightColorSchemeMediaQueries,
  rewriteColorSchemeMediaQueries,
} from './cssScoping/mediaQueries';
import {
  removeImportedPageChromeSelectors,
  removeImportedRootLayoutDeclarations,
  removeImportedRootPseudoElementSelectors,
} from './cssScoping/rootDeclarations';
import { scopeSelectorList } from './cssScoping/selectorScoping';
import type { MarkdownThemePlatform } from './types';

export function scopeImportedMarkdownThemeCss(
  css: string,
  platform: MarkdownThemePlatform,
  scopeSelector = getMarkdownThemeRootScopeSelector(platform)
): string {
  return rewriteCssSelectors(css, platform, scopeSelector);
}

function rewriteCssSelectors(
  css: string,
  platform: MarkdownThemePlatform,
  scopeSelector: string
): string {
  const root = postcss.parse(css, { from: undefined });

  root.walkRules((rule) => {
    if (isKeyframesRule(rule)) return;

    rule.selector = scopeSelectorList(rule.selector, scopeSelector);
    if (removeImportedPageChromeSelectors(rule)) return;
    if (removeImportedRootPseudoElementSelectors(rule)) return;
    removeImportedRootLayoutDeclarations(rule, platform);
  });

  if (platform === 'typora') {
    resolveFixedLightColorSchemeMediaQueries(root);
  } else {
    rewriteColorSchemeMediaQueries(root, scopeSelector);
  }
  return root.toString();
}
