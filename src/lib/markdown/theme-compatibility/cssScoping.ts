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
import { splitSelectorList } from './cssScoping/selectorList';
import { scopeSelectorList } from './cssScoping/selectorScoping';
import type { MarkdownThemePlatform } from './types';

const TYPORA_INLINE_WRAPPER_LAYOUT_PROPS = new Set([
  'display',
  'line-height',
]);

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
  let root: postcss.Root;
  try {
    root = postcss.parse(css, { from: undefined });
  } catch {
    return '';
  }

  root.walkRules((rule) => {
    if (isKeyframesRule(rule)) return;

    const sourceSelector = platform === 'typora'
      ? splitImportedInlineWrapperLayoutSelectors(rule)
      : rule.selector;
    rule.selector = scopeSelectorList(rule.selector, scopeSelector);
    if (removeImportedPageChromeSelectors(rule)) return;
    if (removeImportedRootPseudoElementSelectors(rule)) return;
    if (platform === 'typora') {
      if (removeImportedInlineWrapperLayoutDeclarations(rule, sourceSelector)) return;
    }
    removeImportedRootLayoutDeclarations(rule, platform);
  });

  if (platform === 'typora') {
    resolveFixedLightColorSchemeMediaQueries(root);
  } else {
    rewriteColorSchemeMediaQueries(root, scopeSelector);
  }
  return root.toString();
}

function removeImportedInlineWrapperLayoutDeclarations(
  rule: postcss.Rule,
  sourceSelector: string
): boolean {
  const selectors = splitSelectorList(sourceSelector);
  if (
    selectors.length === 0 ||
    !selectors.every(selectorTargetsImportedTyporaNonImageInlineWrapper)
  ) {
    return false;
  }

  rule.walkDecls((declaration) => {
    if (TYPORA_INLINE_WRAPPER_LAYOUT_PROPS.has(declaration.prop.toLowerCase())) {
      declaration.remove();
    }
  });

  if (!rule.nodes?.some((node) => node.type === 'decl')) {
    rule.remove();
    return true;
  }

  return false;
}

function splitImportedInlineWrapperLayoutSelectors(rule: postcss.Rule): string {
  if (!rule.nodes?.some((node) => (
    node.type === 'decl' &&
    TYPORA_INLINE_WRAPPER_LAYOUT_PROPS.has(node.prop.toLowerCase())
  ))) {
    return rule.selector;
  }

  const selectors = splitSelectorList(rule.selector);
  if (selectors.length <= 1) {
    return rule.selector;
  }

  const inlineWrapperSelectors = selectors.filter(selectorTargetsImportedTyporaNonImageInlineWrapper);
  if (inlineWrapperSelectors.length === 0 || inlineWrapperSelectors.length === selectors.length) {
    return rule.selector;
  }

  const otherSelectors = selectors.filter((selector) => (
    !selectorTargetsImportedTyporaNonImageInlineWrapper(selector)
  ));
  rule.cloneAfter({ selector: otherSelectors.join(',\n') });
  rule.selector = inlineWrapperSelectors.join(',\n');
  return rule.selector;
}

function selectorTargetsImportedTyporaNonImageInlineWrapper(selector: string): boolean {
  let quote: string | null = null;
  let parenDepth = 0;

  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index];
    const previous = selector[index - 1];

    if (quote) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
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

    if (char !== '[' || parenDepth > 0) {
      continue;
    }

    const attributeEnd = findSelectorAttributeEnd(selector, index);
    if (attributeEnd < 0) {
      return false;
    }

    const value = getMdInlineAttributeValue(selector.slice(index + 1, attributeEnd));
    if (value && value.toLowerCase() !== 'image') {
      return true;
    }
    index = attributeEnd;
  }

  return false;
}

function findSelectorAttributeEnd(selector: string, openBracketIndex: number): number {
  let quote: string | null = null;

  for (let index = openBracketIndex + 1; index < selector.length; index += 1) {
    const char = selector[index];
    const previous = selector[index - 1];

    if (quote) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === ']') {
      return index;
    }
  }

  return -1;
}

function getMdInlineAttributeValue(attributeContent: string): string | null {
  const match = /^\s*md-inline\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))/i.exec(attributeContent);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}
