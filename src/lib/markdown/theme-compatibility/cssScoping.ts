import postcss from 'postcss';
import type { MarkdownThemePlatform } from './types';
import { getMarkdownThemeRootScopeSelector } from './dom';
import { selectorTargetsImportedPageChrome } from './selectorClassification';

export function scopeImportedMarkdownThemeCss(
  css: string,
  platform: MarkdownThemePlatform,
  scopeSelector = getMarkdownThemeRootScopeSelector(platform)
): string {
  return rewriteCssSelectors(css, platform, scopeSelector, (selector) => scopeSelectorList(selector, scopeSelector));
}

function rewriteCssSelectors(
  css: string,
  platform: MarkdownThemePlatform,
  scopeSelector: string,
  rewriteSelector: (selector: string) => string
): string {
  const root = postcss.parse(css, { from: undefined });
  root.walkRules((rule) => {
    if (isKeyframesRule(rule)) return;
    rule.selector = rewriteSelector(rule.selector);
    if (removeImportedPageChromeSelectors(rule)) return;
    if (removeImportedRootPseudoElementSelectors(rule)) return;
    removeImportedRootLayoutDeclarations(rule, platform);
  });
  rewriteColorSchemeMediaQueries(root, scopeSelector);
  return root.toString();
}

function isKeyframesRule(rule: postcss.Rule): boolean {
  let parent = rule.parent as postcss.AnyNode | undefined;
  while (parent) {
    if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) {
      return true;
    }
    parent = parent.parent as postcss.AnyNode | undefined;
  }
  return false;
}

function scopeSelectorList(selectorList: string, scopeSelector: string): string {
  return splitSelectorList(selectorList)
    .map((selector) => scopeSingleSelector(selector, scopeSelector))
    .join(',\n');
}

function rewriteColorSchemeMediaQueries(root: postcss.Root, scopeSelector: string): void {
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
    atRule.replaceWith(...(atRule.nodes ?? []));
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
    .map((part) => part
      .replace(/\s+and\s+\(\s*prefers-color-scheme\s*:\s*(?:dark|light)\s*\)/gi, '')
      .replace(/\(\s*prefers-color-scheme\s*:\s*(?:dark|light)\s*\)\s+and\s+/gi, '')
      .replace(/\(\s*prefers-color-scheme\s*:\s*(?:dark|light)\s*\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s+and\s*$/i, '')
      .replace(/^and\s+/i, '')
      .trim())
    .filter(Boolean);

  return parts.join(', ');
}

function addRootStateClassToSelectorList(
  selectorList: string,
  scopeSelector: string,
  rootStateClass: string
): string {
  return splitSelectorList(selectorList)
    .map((selector) => addRootStateClassToSelector(selector, scopeSelector, rootStateClass))
    .join(',\n');
}

function addRootStateClassToSelector(
  selector: string,
  scopeSelector: string,
  rootStateClass: string
): string {
  const trimmed = selector.trim();
  if (!trimmed) return trimmed;
  if (!isSelectorAlreadyScoped(trimmed, scopeSelector)) {
    return `${scopeSelector}${rootStateClass} ${trimmed}`;
  }

  const afterScope = trimmed.slice(scopeSelector.length);
  if (new RegExp(`^${escapeRegExp(rootStateClass)}(?=$|[.#:[>+~\\s])`, 'i').test(afterScope)) {
    return trimmed;
  }

  return `${scopeSelector}${rootStateClass}${afterScope}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ROOT_LAYOUT_DECLARATION_PATTERN = /^(?:margin|padding)(?:$|-)|^(?:min-|max-)?(?:width|height)$|^overflow(?:$|-)|^(?:inset|top|right|bottom|left)$|^(?:position|display|float|clear|transform|translate|scale|rotate|container)$/i;
const ROOT_PAGE_DECORATION_DECLARATION_PATTERN = /^(?:box-shadow|outline(?:$|-)|border(?:$|-(?:left|right)(?:$|-))|background(?:-image|-position|-repeat|-size|-attachment|-clip|-origin)?)$/i;
const TYPORA_UNSAFE_ROOT_DECLARATION_PATTERN = /^(?:position|inset|top|right|bottom|left|float|clear|transform|translate|scale|rotate|container|z-index)$/i;

function removeImportedPageChromeSelectors(rule: postcss.Rule): boolean {
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

function removeImportedRootPseudoElementSelectors(rule: postcss.Rule): boolean {
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

function removeImportedRootLayoutDeclarations(rule: postcss.Rule, platform: MarkdownThemePlatform): void {
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

function splitSelectorList(selectorList: string): string[] {
  const selectors: string[] = [];
  let start = 0;
  let quote: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let index = 0; index < selectorList.length; index += 1) {
    const char = selectorList[index];
    const previous = selectorList[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (char === '[') bracketDepth += 1;
    if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (char === ',' && parenDepth === 0 && bracketDepth === 0) {
      selectors.push(selectorList.slice(start, index).trim());
      start = index + 1;
    }
  }

  selectors.push(selectorList.slice(start).trim());
  return selectors.filter(Boolean);
}

function scopeSingleSelector(selector: string, scopeSelector: string): string {
  const normalized = normalizeInlineElementAliases(
    normalizeTaskCheckboxAliases(
      normalizeCodeMirrorElementAliases(
        normalizeContentElementAliases(
          normalizeFunctionalRootAliases(selector.trim())
        )
      )
    )
  );
  if (!normalized) return scopeSelector;
  if (isSelectorAlreadyScoped(normalized, scopeSelector)) return normalized;

  const scopedRootSelector = scopeLeadingRootSelector(normalized, scopeSelector);
  if (scopedRootSelector) {
    return scopedRootSelector;
  }

  return `${scopeSelector} ${normalized}`;
}

function normalizeContentElementAliases(selector: string): string {
  const aliases: string[] = [];
  const stash = (value: string) => {
    const token = `__VLAINA_CONTENT_ALIAS_${aliases.length}__`;
    aliases.push(value);
    return token;
  };

  let result = selector
    .replace(
      /(^|[\s>+~,(])figure\.table-figure(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) =>
        `${prefix}${stash(':is(figure.table-figure, .milkdown-table-block.table-figure)')}`
    )
    .replace(
      /(^|[\s>+~,(])\.el-pre\s+pre\s+code(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash(':is(.el-pre.code-block-container .cm-content, .el-pre .code-block-lazy-preview)')}`
    )
    .replace(
      /(^|[\s>+~,(])\.el-pre\s+pre(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash(':is(.el-pre.code-block-container, .el-pre .code-block-lazy-preview)')}`
    )
    .replace(
      /(^|[\s>+~,(])(?:div|span)((?:\[[^\]]+\])+)(?=$|[\s>+~):.#\[])/gi,
      (match: string, prefix: string, attrSelectors: string) => {
        if (!/\[\s*src\b/i.test(attrSelectors)) return match;
        return `${prefix}${stash(`.image-block-container${attrSelectors}`)}`;
      }
    )
    .replace(
      /(^|[\s>+~,(])((?:\.md-image|\[[^\]]+\])+)\s*>\s*img(?=$|[\s>+~):.#\[])/gi,
      (match: string, prefix: string, mdImageCompound: string) => {
        if (!isImageAliasCompound(mdImageCompound)) return match;
        return `${prefix}${stash(`:is(${mdImageCompound} > img, ${renderImageContainerCompound(mdImageCompound)} img)`)}`;
      }
    )
    .replace(
      /(^|[\s>+~,(])((?:\.md-image|\[[^\]]+\])+)(?=$|[\s>+~):.#\[])/gi,
      (match: string, prefix: string, mdImageCompound: string) => {
        if (!isImageAliasCompound(mdImageCompound)) return match;
        return `${prefix}${stash(`:is(${mdImageCompound}, ${renderImageContainerCompound(mdImageCompound)})`)}`;
      }
    )
    .replace(
      /(^|[\s>+~,(])img((?:\[[^\]]+\])+)(?=$|[\s>+~):.#\[])/gi,
      (match: string, prefix: string, attrSelectors: string) => {
        if (!/\[\s*src\b/i.test(attrSelectors)) return match;
        return `${prefix}${stash(`:is(img${attrSelectors}, .image-block-container${attrSelectors} img)`)}`;
      }
    )
    .replace(
      /(^|[\s>+~,(])pre\s+code(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash(':is(pre code, .code-block-container .cm-content)')}`
    )
    .replace(
      /(^|[\s>+~,(])\.style\s+\.token\.string(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.language-css .token.string')}`
    )
    .replace(
      /(^|[\s>+~,(])\.mathjax-block(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash(':is(.mathjax-block, [data-type="math-block"], .math-block-wrapper)')}`
    )
    .replace(
      /(^|[\s>+~,(])table\.v-freeze\.auto(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) =>
        `${prefix}${stash(':is(table.v-freeze.auto, .milkdown-table-block.v-freeze.auto table)')}`
    )
    .replace(/(^|[\s>+~,(])pre(?=\.md-meta-block\b)/gi, '$1')
    .replace(/(^|[\s>+~,(])pre(?=\.md-fences\b)/gi, '$1')
    .replace(
      /(^|[\s>+~,(])pre\.ty-contain-cm(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.code-block-container')}`
    )
    .replace(
      /(^|[\s>+~,(])pre(\[[^\]]*language-[^\]]*\])(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string, attrSelector: string) =>
        `${prefix}${stash(`:is(pre${attrSelector}, .code-block-container${attrSelector})`)}`
    )
    .replace(
      /(^|[\s>+~,(])pre:not\(\.frontmatter\)(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash(':is(pre:not([data-type="frontmatter"]), .code-block-container:not(.frontmatter-block-container))')}`
    )
    .replace(
      /(^|[\s>+~,(])pre(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash(':is(pre, .code-block-container)')}`
    );

  aliases.forEach((value, index) => {
    result = result.replaceAll(`__VLAINA_CONTENT_ALIAS_${index}__`, value);
  });

  return result;
}

function renderImageContainerCompound(mdImageCompound: string): string {
  return mdImageCompound
    .replace(/\.md-image\b/gi, '.image-block-container')
    .replace(/\[\s*md-inline\s*=\s*(?:"image"|'image'|image)\s*\]/gi, '.image-block-container');
}

function isImageAliasCompound(compound: string): boolean {
  return /\.md-image\b/i.test(compound)
    || /\[\s*md-inline\s*=\s*(?:"image"|'image'|image)\s*\]/i.test(compound);
}

function normalizeTaskCheckboxAliases(selector: string): string {
  const aliases: string[] = [];
  const stash = (value: string) => {
    const token = `__VLAINA_TASK_CHECKBOX_ALIAS_${aliases.length}__`;
    aliases.push(value);
    return token;
  };

  let result = selector
    .replace(
      /(^|[\s>+~,(])li\s+label\.checkbox(?=$|[\s>+~),.#\[:])/gi,
      (_match, prefix: string) => `${prefix}${stash("li[data-item-type='task']::before")}`
    )
    .replace(
      /(^|[\s>+~,(])((?:table\s+td\s+)?)label\.checkbox(?=$|[\s>+~),.#\[:])/gi,
      (_match, prefix: string, tablePrefix: string) =>
        `${prefix}${stash(`${tablePrefix}li[data-item-type='task']::before`)}`
    )
    .replace(
      /(^|[\s>+~,(])\.checkbox\s*>\s*svg(?=$|[\s>+~),.#\[:])/gi,
      (_match, prefix: string) => `${prefix}${stash("li[data-item-type='task']::before")}`
    )
    .replace(
      /(^|[\s>+~,(])input((?:\[[^\]]+\])*)\:checked(?:(?:::before|::after|:before|:after))?(?=$|[\s>+~),.#\[:])/gi,
      (match: string, prefix: string, attrSelectors: string) => {
        const taskSelector = extractTaskDataSelector(attrSelectors);
        if (!taskSelector) return match;
        return `${prefix}${stash(renderTaskCheckboxSelector(taskSelector))}`;
      }
    )
    .replace(
      /(^|[\s>+~,(])li((?:\[[^\]]+\]|\.[_a-zA-Z]+[_a-zA-Z0-9-]*)*)\s*>\s*(?:p\s*>\s*)?input(?:\[[^\]]+\])*\:checked(?:(?:::before|::after|:before|:after))?(?=$|[\s>+~),.#\[:])/gi,
      (match: string, prefix: string, liSelectors: string) => {
        const taskSelector = extractTaskDataSelector(liSelectors);
        if (!taskSelector) return match;
        return `${prefix}${stash(renderTaskCheckboxSelector(taskSelector))}`;
      }
    );

  aliases.forEach((value, index) => {
    result = result.replaceAll(`__VLAINA_TASK_CHECKBOX_ALIAS_${index}__`, value);
  });

  return result;
}

function extractTaskDataSelector(selectors: string): string | null {
  const matches = Array.from(selectors.matchAll(/\[\s*data-task(?:\s*(?:[*^$|~]?=)\s*(?:"[^"]*"|'[^']*'|[^\]\s]+))?\s*\]/gi));
  if (matches.length === 0) return null;
  return matches.map((match) => match[0]).join('');
}

function renderTaskCheckboxSelector(taskSelector: string): string {
  return `li[data-item-type='task']${taskSelector}[data-checked='true']::before`;
}

function normalizeCodeMirrorElementAliases(selector: string): string {
  const aliases: string[] = [];
  const stash = (value: string) => {
    const token = `__VLAINA_CODEMIRROR_ALIAS_${aliases.length}__`;
    aliases.push(value);
    return token;
  };

  let result = selector
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-focused\s+\.CodeMirror-activeline-gutter\s*\+\s*\.CodeMirror-line(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-editor.cm-focused .cm-activeLine')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-focused\s+\.CodeMirror-activeline\s+\.CodeMirror-linenumber(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-editor.cm-focused .cm-activeLineGutter')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-activeline-background(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-activeLine')}`
    )
    .replace(
      /(^|[\s>+~,(])\.cm-gutterElement\.cm-active(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-gutterElement.cm-activeLineGutter')}`
    )
    .replace(
      /(^|[\s>+~,(])([a-z][\w-]*)\.CodeMirror-cursor(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string, element: string) => `${prefix}${stash(`${element}.cm-cursor`)}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-cursor(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-cursor')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-gutters(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-gutters')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-linenumber(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash(':is(.cm-lineNumbers .cm-gutterElement, .code-block-lazy-line-numbers)')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-lines(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-content')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-scroll(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-scroller')}`
    )
    .replace(
      /(^|[\s>+~,(])\.CodeMirror-line(?=$|[\s>+~):.#\[])/gi,
      (_match, prefix: string) => `${prefix}${stash('.cm-line')}`
    );

  aliases.forEach((value, index) => {
    result = result.replaceAll(`__VLAINA_CODEMIRROR_ALIAS_${index}__`, value);
  });

  return result;
}

const INLINE_ELEMENT_ALIASES: Array<{
  markdownInline: string;
  element: string;
}> = [
  { markdownInline: 'code', element: 'code' },
  { markdownInline: 'em', element: 'em' },
  { markdownInline: 'strong', element: 'strong' },
  { markdownInline: 'highlight', element: 'mark' },
  { markdownInline: 'mark', element: 'mark' },
  { markdownInline: 'sup', element: 'sup' },
  { markdownInline: 'sub', element: 'sub' },
  { markdownInline: 'underline', element: 'u' },
  { markdownInline: 'u', element: 'u' },
  { markdownInline: 'del', element: 'del' },
  { markdownInline: 'delete', element: 'del' },
  { markdownInline: 's', element: 'del' },
];

const INLINE_WRAPPER_PSEUDO_PATTERN = String.raw`((?::(?:only-child|first-child|last-child|not\(\s*:(?:only-child|first-child|last-child)\s*\)))*)`;
const PLAIN_INLINE_ATTR_PATTERN = String.raw`(?:span)?\[md-inline\s*=\s*(?:"plain"|'plain'|plain)\]`;

function normalizeInlineElementAliases(selector: string): string {
  let result = selector;

  result = normalizeInlineImageAliases(result);

  for (const { markdownInline, element } of INLINE_ELEMENT_ALIASES) {
    const attrPattern = String.raw`\[md-inline\s*=\s*(?:"${markdownInline}"|'${markdownInline}'|${markdownInline})\]`;
    const plainChildWrapperHasPattern = new RegExp(
      String.raw`(^|[\s>+~,(])(?:span)?${attrPattern}${INLINE_WRAPPER_PSEUDO_PATTERN}:has\(\s*>\s*${element}\s*>\s*${PLAIN_INLINE_ATTR_PATTERN}\s*\)(?=$|[\s>+~):.#\[])`,
      'gi'
    );
    result = result.replace(
      plainChildWrapperHasPattern,
      (match: string, prefix: string, wrapperPseudos: string, offset: number) => {
        if (isNegativeFunctionAliasMatch(result, offset, prefix)) return match;
        return `${prefix}${element}${wrapperPseudos}`;
      }
    );
    const directWrapperHasPattern = new RegExp(
      String.raw`(^|[\s>+~,(])(?:span)?${attrPattern}${INLINE_WRAPPER_PSEUDO_PATTERN}:has\(\s*>\s*${element}\s*\)(?=$|[\s>+~):.#\[])`,
      'gi'
    );
    result = result.replace(
      directWrapperHasPattern,
      (match: string, prefix: string, wrapperPseudos: string, offset: number) => {
        if (isNegativeFunctionAliasMatch(result, offset, prefix)) return match;
        return `${prefix}${element}${wrapperPseudos}`;
      }
    );
    const wrapperPattern = new RegExp(
      String.raw`(^|[\s>+~,(])(?:span)?${attrPattern}${INLINE_WRAPPER_PSEUDO_PATTERN}\s*>\s*${element}(?=$|[\s>+~):.#\[])`,
      'gi'
    );
    result = result.replace(
      wrapperPattern,
      (match: string, prefix: string, wrapperPseudos: string, offset: number) => {
        if (isNegativeFunctionAliasMatch(result, offset, prefix)) return match;
        return `${prefix}${element}${wrapperPseudos}`;
      }
    );

    const standalonePattern = new RegExp(
      String.raw`(^|[\s>+~,(])(?:span)?${attrPattern}(?=$|[\s>+~):.#\[])`,
      'gi'
    );
    result = result.replace(
      standalonePattern,
      (match: string, prefix: string, offset: number) => {
        if (isNegativeFunctionAliasMatch(result, offset, prefix)) return match;
        return `${prefix}${element}`;
      }
    );
  }

  return normalizeResidualTyporaInlineWrappers(result);
}

function normalizeInlineImageAliases(selector: string): string {
  const imageAttrPattern = String.raw`\[md-inline\s*=\s*(?:"image"|'image'|image)\]`;
  const imageWrapperPattern = new RegExp(
    String.raw`(^|[\s>+~,(])(?:span)?${imageAttrPattern}((?:\[[^\]]+\])*)(?=$|[\s>+~):.#\[])`,
    'gi'
  );

  return selector.replace(
    imageWrapperPattern,
    (match: string, prefix: string, attrSelectors: string, offset: number) => {
      if (isNegativeFunctionAliasMatch(selector, offset, prefix)) return match;
      return `${prefix}.image-block-container${attrSelectors}`;
    }
  );
}

function normalizeResidualTyporaInlineWrappers(selector: string): string {
  const inlineElementPattern = String.raw`(?:code|em|strong|mark|sup|sub|u|del)`;
  let result = selector;

  result = result
    .replace(
      new RegExp(String.raw`:has\(\s*>\s*em\s*>\s*(span:first-child\s*\+\s*)?(${inlineElementPattern})((?::(?:only-child|first-child|last-child))*)\s*\)`, 'gi'),
      (_match: string, _plainPrefix: string, element: string, pseudos: string) => `:has(>${element}${pseudos})`
    )
    .replace(
      new RegExp(String.raw`:has\(\s*span:first-child\s*\+\s*(${inlineElementPattern})((?::(?:only-child|first-child|last-child))*)\s*\)`, 'gi'),
      (_match: string, element: string, pseudos: string) => `:has(>${element}${pseudos})`
    )
    .replace(
      new RegExp(String.raw`:has\(\s*(${inlineElementPattern})((?::(?:only-child|first-child|last-child))*)\s*\+\s*span:last-child\s*\)`, 'gi'),
      (_match: string, element: string, pseudos: string) => `:has(>${element}${pseudos})`
    )
    .replace(
      new RegExp(String.raw`>\s*span:first-child\s*\+\s*(${inlineElementPattern})((?::(?:only-child|first-child|last-child))*)(?=$|[\s>+~):.#\[])`, 'gi'),
      (_match: string, element: string, pseudos: string) => `>${element}${pseudos}`
    )
    .replace(
      new RegExp(String.raw`((?:th|td)(?::[a-z-]+(?:\([^)]*\))?)*)\s*>\s*span\s*>\s*(${inlineElementPattern})((?::(?:only-child|first-child|last-child))*)`, 'gi'),
      (_match: string, cellSelector: string, element: string, pseudos: string) => `${cellSelector} ${element}${pseudos}`
    )
    .replace(
      new RegExp(String.raw`(:is\([^)]*\))\s*>\s*span\s*>\s*(${inlineElementPattern})((?::(?:only-child|first-child|last-child))*)`, 'gi'),
      (_match: string, cellSelector: string, element: string, pseudos: string) => `${cellSelector} ${element}${pseudos}`
    );

  return result;
}

function isNegativeFunctionAliasMatch(selector: string, matchOffset: number, prefix: string): boolean {
  const aliasStartOffset = matchOffset + prefix.length;
  return /:not\(\s*$/i.test(selector.slice(Math.max(0, aliasStartOffset - 16), aliasStartOffset));
}

function isSelectorAlreadyScoped(selector: string, scopeSelector: string): boolean {
  if (!selector.startsWith(scopeSelector)) return false;

  const next = selector[scopeSelector.length] ?? '';
  return next === ''
    || /\s/.test(next)
    || next === '>'
    || next === '+'
    || next === '~'
    || next === '.'
    || next === '#'
    || next === ':'
    || next === '[';
}

function scopeLeadingRootSelector(selector: string, scopeSelector: string): string | null {
  const folded = foldLeadingRootSelector(selector);
  if (!folded) return null;
  if (!folded.remaining) return `${scopeSelector}${folded.rootSuffix}`;
  return `${scopeSelector}${folded.rootSuffix} ${folded.remaining}`;
}

function foldNestedLeadingRootSelector(selector: string): string {
  const normalized = selector.trim();
  if (!normalized) return normalized;

  const folded = foldLeadingRootSelector(normalized);
  if (!folded) return normalized;
  if (!folded.remaining) return folded.rootSuffix || normalized;
  if (!folded.rootSuffix) return folded.remaining;
  return `${folded.rootSuffix} ${folded.remaining}`;
}

function foldLeadingRootSelector(selector: string): {
  rootSuffix: string;
  remaining: string;
} | null {
  let remaining = selector;
  let rootSuffix = '';
  let consumedRoot = false;

  while (remaining) {
    const consumed = consumeLeadingThemeState(remaining)
      ?? (consumedRoot ? consumeLeadingRootState(remaining) : consumeLeadingStandaloneRootState(remaining))
      ?? consumeLeadingDocumentRoot(remaining)
      ?? consumeLeadingMarkdownRootAlias(remaining);
    if (!consumed) break;

    rootSuffix += consumed.rootSuffix;
    consumedRoot = true;

    const nextRootCandidate = trimLeadingCombinator(consumed.rest);
    if (!nextRootCandidate) {
      remaining = '';
      break;
    }

    if (canConsumeLeadingRoot(nextRootCandidate)) {
      remaining = nextRootCandidate;
      continue;
    }

    remaining = formatRemainingDescendantSelector(consumed.rest);
    break;
  }

  if (!consumedRoot) return null;
  return { rootSuffix, remaining };
}

function canConsumeLeadingRoot(selector: string): boolean {
  return Boolean(
    consumeLeadingThemeState(selector)
      ?? consumeLeadingRootState(selector)
      ?? consumeLeadingDocumentRoot(selector)
      ?? consumeLeadingMarkdownRootAlias(selector)
  );
}

function consumeLeadingThemeState(selector: string): { rootSuffix: string; rest: string } | null {
  const match = selector.match(/^\.theme-(?:dark|light)(?=$|[\s.#:[>+~])/i);
  if (!match) return null;

  return {
    rootSuffix: match[0],
    rest: selector.slice(match[0].length),
  };
}

function consumeLeadingRootState(selector: string): { rootSuffix: string; rest: string } | null {
  const match = selector.match(/^\.((?:is-(?:live-preview|phone|mobile|tablet|desktop|readable-line-width))|ty-on-typewriter-mode|mod-cm5|max|wide)(?=$|[\s.#:[>+~])/i);
  if (!match) return null;

  const rootState = match[1].toLowerCase() === 'mod-cm5' ? '.mod-cm6' : match[0];
  return {
    rootSuffix: rootState,
    rest: selector.slice(match[0].length),
  };
}

function consumeLeadingStandaloneRootState(selector: string): { rootSuffix: string; rest: string } | null {
  const match = selector.match(/^\.((?:is-(?:live-preview|phone|mobile|tablet|desktop|readable-line-width))|ty-on-typewriter-mode)(?=$|[\s.#:[>+~])/i);
  if (!match) return null;

  return {
    rootSuffix: match[0],
    rest: selector.slice(match[0].length),
  };
}

function consumeLeadingDocumentRoot(selector: string): { rootSuffix: string; rest: string } | null {
  const prefix = selector.match(/^(?:html|body|:root)(?=$|[\s>+~):.#\[])/i)?.[0];
  if (!prefix) return null;

  const boundary = findTopLevelBoundary(selector, prefix.length);
  const compound = boundary < 0 ? selector : selector.slice(0, boundary);
  const rootSuffix = normalizeDocumentRootSuffix(compound.slice(prefix.length));
  const rest = boundary < 0 ? '' : selector.slice(boundary);

  return {
    rootSuffix,
    rest,
  };
}

function normalizeDocumentRootSuffix(rootSuffix: string): string {
  return rootSuffix
    .replace(/\.(?:typora-export|typora-export-content)(?=$|[.#:[)])/gi, '')
    .replace(/:not\(\s*\[class\]\s*\)/gi, '');
}

const MARKDOWN_ROOT_ALIAS_PATTERN = /^(?:#write|\.markdown-preview-view|\.markdown-rendered|\.markdown-reading-view|\.markdown-preview-section|\.markdown-source-view|\.cm-s-obsidian|\.mod-cm6)(?=$|[\s>+~):.#\[])/i;
const MARKDOWN_WRAPPER_ALIAS_PATTERN = /^(?:content|\.typora-export|\.typora-export-content|\.workspace-leaf-content|\.view-content|\.markdown-preview-sizer|\.markdown-preview-pusher|\.markdown-preview-spacer)(?=$|[\s>+~):.#\[])/i;
const SELECTOR_LIST_FUNCTION_PATTERN = /^:((?:-webkit-|-moz-)?(?:is|where|not|has|any|matches))\(/i;
const POSITIVE_SELECTOR_LIST_FUNCTION_PATTERN = /^(?:-webkit-|-moz-)?(?:is|where|has|any|matches)$/i;
const SIMPLIFIABLE_SELECTOR_LIST_FUNCTION_PATTERN = /^(?:-webkit-|-moz-)?(?:is|where|any|matches)$/i;

function normalizeFunctionalRootAliases(selector: string): string {
  let result = '';
  let segmentStart = 0;
  let quote: string | null = null;
  let bracketDepth = 0;

  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index];
    const previous = selector[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '[') {
      bracketDepth += 1;
      continue;
    }
    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (bracketDepth > 0 || char !== ':') continue;

    const match = selector.slice(index).match(SELECTOR_LIST_FUNCTION_PATTERN);
    if (!match) continue;

    const openParenIndex = index + match[0].length - 1;
    const closeParenIndex = findMatchingParen(selector, openParenIndex);
    if (closeParenIndex < 0) continue;

    const inner = selector.slice(openParenIndex + 1, closeParenIndex);
    const shouldFoldRootAliases = POSITIVE_SELECTOR_LIST_FUNCTION_PATTERN.test(match[1]);
    const normalizedArguments = splitSelectorList(inner)
      .map((argument) => {
        const normalizedArgument = normalizeFunctionalRootAliases(argument);
        return shouldFoldRootAliases
          ? foldNestedLeadingRootSelector(normalizedArgument)
          : normalizedArgument.trim();
      });
    const contentArguments = shouldFoldRootAliases
      ? normalizedArguments.filter((argument) =>
        !selectorTargetsImportedPageChrome(argument)
        && !selectorTargetsOnlyMarkdownRootWrapperAlias(argument)
      )
      : normalizedArguments;
    const finalArguments = contentArguments.length > 0 ? contentArguments : normalizedArguments;
    const normalizedInner = finalArguments.join(', ');
    const renderedFunction = SIMPLIFIABLE_SELECTOR_LIST_FUNCTION_PATTERN.test(match[1]) && finalArguments.length === 1
      ? finalArguments[0]
      : `:${match[1]}(${normalizedInner})`;

    result += selector.slice(segmentStart, index);
    result += renderedFunction;
    index = closeParenIndex;
    segmentStart = closeParenIndex + 1;
  }

  return result + selector.slice(segmentStart);
}

function selectorTargetsOnlyMarkdownRootWrapperAlias(selector: string): boolean {
  return Boolean(selector.trim().match(MARKDOWN_WRAPPER_ALIAS_PATTERN));
}

function consumeLeadingMarkdownRootAlias(selector: string): { rootSuffix: string; rest: string } | null {
  const rootAlias = selector.match(MARKDOWN_ROOT_ALIAS_PATTERN)?.[0];
  const wrapperAlias = rootAlias ? null : selector.match(MARKDOWN_WRAPPER_ALIAS_PATTERN)?.[0];
  const prefix = rootAlias ?? wrapperAlias;
  if (!prefix) return null;

  const boundary = findTopLevelBoundary(selector, prefix.length);
  const compound = boundary < 0 ? selector : selector.slice(0, boundary);
  const rest = boundary < 0 ? '' : selector.slice(boundary);

  return {
    rootSuffix: rootAlias ? normalizeMarkdownRootAliasSuffix(compound) : '',
    rest,
  };
}

function normalizeMarkdownRootAliasSuffix(rootSuffix: string): string {
  return rootSuffix.replace(/\.mod-cm5(?=$|[.#:[)])/gi, '.mod-cm6');
}

function findTopLevelBoundary(selector: string, start: number): number {
  let quote: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let index = start; index < selector.length; index += 1) {
    const char = selector[index];
    const previous = selector[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (char === '[') bracketDepth += 1;
    if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (parenDepth === 0 && bracketDepth === 0 && (/[\s>+~]/.test(char))) {
      return index;
    }
  }

  return -1;
}

function findMatchingParen(selector: string, openParenIndex: number): number {
  let quote: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let index = openParenIndex; index < selector.length; index += 1) {
    const char = selector[index];
    const previous = selector[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '[') {
      bracketDepth += 1;
      continue;
    }
    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (bracketDepth > 0) continue;
    if (char === '(') {
      parenDepth += 1;
      continue;
    }
    if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function trimLeadingCombinator(selector: string): string {
  return selector.replace(/^\s*(?:[>+~]\s*)?/, '').trim();
}

function formatRemainingDescendantSelector(selector: string): string {
  const trimmed = selector.trim();
  if (trimmed.startsWith('>')) {
    return trimmed;
  }
  if (trimmed.startsWith('+') || trimmed.startsWith('~')) {
    return trimmed.slice(1).trim();
  }
  return trimmed;
}
