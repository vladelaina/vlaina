import postcss from 'postcss';
import { selectorTargetsImportedPageChrome } from '../selectorClassification';
import type { MarkdownThemePlatform } from '../types';
import { findTopLevelBoundary, splitSelectorList } from './selectorList';

const ROOT_LAYOUT_DECLARATION_PATTERN = new RegExp([
  String.raw`^(?:margin|padding)(?:$|-)`,
  String.raw`^(?:min-|max-)?(?:width|height)$`,
  String.raw`^overflow(?:$|-)`,
  String.raw`^(?:inset|top|right|bottom|left)$`,
  String.raw`^(?:position|display|float|clear|transform|translate|scale|rotate|container)$`,
].join('|'), 'i');

const ROOT_PAGE_DECORATION_DECLARATION_PATTERN = new RegExp([
  String.raw`^(?:box-shadow|outline(?:$|-))$`,
  String.raw`^border(?:$|-(?:left|right)(?:$|-))`,
  String.raw`^background(?:-image|-position|-repeat|-size|-attachment|-clip|-origin)?$`,
].join('|'), 'i');

const TYPORA_UNSAFE_ROOT_DECLARATION_PATTERN = new RegExp([
  String.raw`^(?:position|inset|top|right|bottom|left)$`,
  String.raw`^(?:float|clear|transform|translate|scale|rotate|container|z-index)$`,
].join('|'), 'i');

export function removeImportedPageChromeSelectors(rule: postcss.Rule): boolean {
  const selectors = splitSelectorList(rule.selector);
  const contentSelectors = selectors.filter((selector) => !selectorTargetsImportedPageChrome(selector));
  if (contentSelectors.length === selectors.length) return false;

  if (contentSelectors.length === 0) {
    rule.remove();
    return true;
  }

  rule.selector = contentSelectors.join(',\n');
  return false;
}

export function removeImportedRootPseudoElementSelectors(rule: postcss.Rule): boolean {
  const selectors = splitSelectorList(rule.selector);
  const contentSelectors = selectors.filter((selector) => !selectorTargetsThemeRootPseudoElement(selector));
  if (contentSelectors.length === selectors.length) return false;

  if (contentSelectors.length === 0) {
    rule.remove();
    return true;
  }

  rule.selector = contentSelectors.join(',\n');
  return false;
}

export function removeImportedRootLayoutDeclarations(
  rule: postcss.Rule,
  platform: MarkdownThemePlatform
): void {
  if (!selectorListTargetsOnlyThemeRoot(rule.selector)) return;

  rule.walkDecls((declaration) => {
    if (platform === 'typora') {
      if (isUnsafeImportedTyporaRootDeclaration(declaration)) {
        declaration.remove();
      }
      return;
    }

    if (
      ROOT_LAYOUT_DECLARATION_PATTERN.test(declaration.prop)
      || ROOT_PAGE_DECORATION_DECLARATION_PATTERN.test(declaration.prop)
    ) {
      declaration.remove();
    }
  });

  if (!rule.nodes?.some((node) => node.type === 'decl')) {
    rule.remove();
  }
}

function isUnsafeImportedTyporaRootDeclaration(declaration: postcss.Declaration): boolean {
  const property = declaration.prop.trim().toLowerCase();
  const value = declaration.value.trim();
  const normalizedValue = value.toLowerCase();

  if (property.startsWith('--')) return false;
  if (TYPORA_UNSAFE_ROOT_DECLARATION_PATTERN.test(property)) return true;

  if (property === 'display') {
    return !/^(?:block|flow-root|contents|initial|inherit|unset)$/i.test(normalizedValue);
  }

  if (/^margin-(?:left|right|inline|inline-start|inline-end)$/i.test(property)) return true;
  if (property === 'margin') return !isSafeRootBoxShorthand(value, { requireBalancedInline: true });
  if (/^padding-(?:left|right|inline|inline-start|inline-end)$/i.test(property)) return true;
  if (property === 'padding') return !isSafeRootBoxShorthand(value, { requireBalancedInline: true });

  if (property === 'width') return !isSafeTyporaRootWidth(value);
  if (property === 'min-width') return !isSafeTyporaRootMinWidth(value);
  if (property === 'max-width') return !isSafeTyporaRootMaxWidth(value);
  if (/^(?:height|max-height)$/i.test(property)) return true;
  if (property === 'overflow' || property.startsWith('overflow-')) {
    return !/^(?:visible|initial|inherit|unset)$/i.test(normalizedValue);
  }

  return false;
}

function isSafeRootBoxShorthand(
  value: string,
  options: { requireBalancedInline: boolean }
): boolean {
  const tokens = splitCssValueTokens(value);
  if (tokens.length === 0 || tokens.length > 4) return false;
  if (tokens.some(isUnsafeRootSpacingToken)) return false;
  if (!options.requireBalancedInline || tokens.length < 4) return true;
  return normalizeCssToken(tokens[1]) === normalizeCssToken(tokens[3]);
}

function isUnsafeRootSpacingToken(token: string): boolean {
  const normalized = token.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === 'auto' || normalized === 'initial' || normalized === 'inherit' || normalized === 'unset') {
    return false;
  }
  return /(^|[\s(,])-\.?\d/.test(normalized)
    || /calc\([^)]*-\s*(?:\d|var\()/i.test(normalized);
}

function isSafeTyporaRootWidth(value: string): boolean {
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  return normalized === 'auto'
    || normalized === '100%'
    || normalized === 'initial'
    || normalized === 'inherit'
    || normalized === 'unset'
    || normalized === '-webkit-fill-available'
    || /^calc\(100%-(?:[^)]+)\)$/.test(normalized)
    || /^min\(100%,/.test(normalized);
}

function isSafeTyporaRootMinWidth(value: string): boolean {
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  return normalized === '0'
    || normalized === '0px'
    || normalized === 'auto'
    || normalized === 'initial'
    || normalized === 'inherit'
    || normalized === 'unset';
}

function isSafeTyporaRootMaxWidth(value: string): boolean {
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  return !normalized.includes('+') && !/calc\([^)]*\+\s*(?:\d|var\()/i.test(normalized);
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

function normalizeCssToken(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function selectorListTargetsOnlyThemeRoot(selectorList: string): boolean {
  const selectors = splitSelectorList(selectorList);
  return selectors.length > 0 && selectors.every(selectorTargetsThemeRoot);
}

function selectorTargetsThemeRoot(selector: string): boolean {
  const normalized = selector.trim();
  if (!normalized.startsWith('[data-markdown-theme-root="true"]')) return false;

  const boundary = findTopLevelBoundary(normalized, 0);
  return boundary < 0;
}

function selectorTargetsThemeRootPseudoElement(selector: string): boolean {
  return selectorTargetsThemeRoot(selector) && /(?:::before|::after|:before|:after)\b/i.test(selector);
}
