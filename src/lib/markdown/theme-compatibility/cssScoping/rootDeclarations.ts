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
  String.raw`^background(?:-color|-image|-position|-repeat|-size|-attachment|-clip|-origin)?$`,
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

export function removeImportedRootPseudoElementSelectors(
  rule: postcss.Rule,
  platform: MarkdownThemePlatform,
  sourceSelectorList = rule.selector
): boolean {
  if (platform === 'typora' && selectorListTargetsOnlyTyporaWritePseudoElement(sourceSelectorList)) {
    return false;
  }

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
  platform: MarkdownThemePlatform,
  sourceSelectorList = rule.selector
): void {
  if (!selectorListTargetsOnlyThemeRoot(rule.selector)) return;
  if (platform === 'typora' && selectorListTargetsOnlyTyporaWritePseudoElement(sourceSelectorList)) {
    sanitizeTyporaWritePseudoElementDeclarations(rule);
    return;
  }

  const targetsTyporaWriteRoot = platform === 'typora'
    && selectorListTargetsOnlyTyporaWriteRoot(sourceSelectorList);

  rule.walkDecls((declaration) => {
    if (platform === 'typora') {
      if (
        targetsTyporaWriteRoot
        && declaration.prop.trim().toLowerCase() === 'line-height'
      ) {
        declaration.cloneBefore({ prop: '--typora-imported-body-line-height' });
      }
      if (isUnsafeImportedTyporaRootDeclaration(declaration, sourceSelectorList)) {
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

function sanitizeTyporaWritePseudoElementDeclarations(rule: postcss.Rule): void {
  rule.walkDecls((declaration) => {
    const property = declaration.prop.trim().toLowerCase();
    const value = declaration.value.trim().toLowerCase();
    const isSafePosition = property === 'position' && value === 'absolute';
    const isSafeInset = /^(?:top|right|bottom|left)$/.test(property) && value === '0';
    const isSafeSize = /^(?:width|height)$/.test(property) && value === '100%';

    if (
      ROOT_LAYOUT_DECLARATION_PATTERN.test(property)
      && !isSafePosition
      && !isSafeInset
      && !isSafeSize
    ) {
      declaration.remove();
    }
  });

  if (!rule.nodes?.some((node) => node.type === 'decl')) {
    rule.remove();
  }
}

function isUnsafeImportedTyporaRootDeclaration(
  declaration: postcss.Declaration,
  sourceSelectorList: string
): boolean {
  const property = declaration.prop.trim().toLowerCase();

  if (property.startsWith('--')) return false;
  if (property === 'font-size') return true;
  if (selectorListTargetsOnlyTyporaWriteRoot(sourceSelectorList)) {
    if (/^padding(?:$|-)/i.test(property)) return false;
    if (property === 'position' && declaration.value.trim().toLowerCase() === 'relative') return false;
  }
  return ROOT_LAYOUT_DECLARATION_PATTERN.test(property)
    || ROOT_PAGE_DECORATION_DECLARATION_PATTERN.test(property);
}

function selectorListTargetsOnlyTyporaWriteRoot(selectorList: string): boolean {
  const selectors = splitSelectorList(selectorList);
  return selectors.length > 0 && selectors.every((selector) => /^#write$/i.test(selector.trim()));
}

function selectorListTargetsOnlyTyporaWritePseudoElement(selectorList: string): boolean {
  const selectors = splitSelectorList(selectorList);
  return selectors.length > 0 && selectors.every((selector) => (
    /^#write(?:::before|::after|:before|:after)$/i.test(selector.trim())
  ));
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
