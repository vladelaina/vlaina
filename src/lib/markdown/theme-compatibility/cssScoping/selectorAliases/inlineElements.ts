import {
  isNegativeFunctionAliasMatch,
  SELECTOR_LEADING_BOUNDARY,
  SELECTOR_TRAILING_BOUNDARY,
} from './shared';

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

const INLINE_WRAPPER_PSEUDO_PATTERN = [
  String.raw`(`,
  String.raw`(?::`,
  String.raw`(?:only-child|first-child|last-child|not\(\s*:(?:only-child|first-child|last-child)\s*\))`,
  String.raw`)*`,
  String.raw`)`,
].join('');
const PLAIN_INLINE_ATTR_PATTERN = String.raw`(?:span)?\[md-inline\s*=\s*(?:"plain"|'plain'|plain)\]`;

export function normalizeInlineElementAliases(selector: string): string {
  let result = normalizeInlineImageAliases(selector);

  for (const { markdownInline, element } of INLINE_ELEMENT_ALIASES) {
    const attrPattern = String.raw`\[md-inline\s*=\s*(?:"${markdownInline}"|'${markdownInline}'|${markdownInline})\]`;
    result = replacePlainChildWrapperHasAlias(result, attrPattern, element);
    result = replaceDirectWrapperHasAlias(result, attrPattern, element);
    result = replaceWrapperAlias(result, attrPattern, element);
    result = replaceStandaloneInlineAlias(result, attrPattern, element);
  }

  return normalizeResidualTyporaInlineWrappers(result);
}

function replacePlainChildWrapperHasAlias(
  selector: string,
  attrPattern: string,
  element: string
): string {
  const pattern = new RegExp(
    `${SELECTOR_LEADING_BOUNDARY}(?:span)?${attrPattern}${INLINE_WRAPPER_PSEUDO_PATTERN}`
      + String.raw`:has\(\s*>\s*`
      + `${element}`
      + String.raw`\s*>\s*`
      + `${PLAIN_INLINE_ATTR_PATTERN}`
      + String.raw`\s*\)`
      + SELECTOR_TRAILING_BOUNDARY,
    'gi'
  );

  return selector.replace(pattern, (match: string, prefix: string, wrapperPseudos: string, offset: number) => {
    if (isNegativeFunctionAliasMatch(selector, offset, prefix)) return match;
    return `${prefix}${element}${wrapperPseudos}`;
  });
}

function replaceDirectWrapperHasAlias(
  selector: string,
  attrPattern: string,
  element: string
): string {
  const pattern = new RegExp(
    `${SELECTOR_LEADING_BOUNDARY}(?:span)?${attrPattern}${INLINE_WRAPPER_PSEUDO_PATTERN}`
      + String.raw`:has\(\s*>\s*`
      + `${element}`
      + String.raw`\s*\)`
      + SELECTOR_TRAILING_BOUNDARY,
    'gi'
  );

  return selector.replace(pattern, (match: string, prefix: string, wrapperPseudos: string, offset: number) => {
    if (isNegativeFunctionAliasMatch(selector, offset, prefix)) return match;
    return `${prefix}${element}${wrapperPseudos}`;
  });
}

function replaceWrapperAlias(
  selector: string,
  attrPattern: string,
  element: string
): string {
  const pattern = new RegExp(
    `${SELECTOR_LEADING_BOUNDARY}(?:span)?${attrPattern}${INLINE_WRAPPER_PSEUDO_PATTERN}`
      + String.raw`\s*>\s*`
      + element
      + SELECTOR_TRAILING_BOUNDARY,
    'gi'
  );

  return selector.replace(pattern, (match: string, prefix: string, wrapperPseudos: string, offset: number) => {
    if (isNegativeFunctionAliasMatch(selector, offset, prefix)) return match;
    return `${prefix}${element}${wrapperPseudos}`;
  });
}

function replaceStandaloneInlineAlias(
  selector: string,
  attrPattern: string,
  element: string
): string {
  const pattern = new RegExp(
    `${SELECTOR_LEADING_BOUNDARY}(?:span)?${attrPattern}${SELECTOR_TRAILING_BOUNDARY}`,
    'gi'
  );

  return selector.replace(pattern, (match: string, prefix: string, offset: number) => {
    if (isNegativeFunctionAliasMatch(selector, offset, prefix)) return match;
    return `${prefix}${element}`;
  });
}

function normalizeInlineImageAliases(selector: string): string {
  const imageAttrPattern = String.raw`\[md-inline\s*=\s*(?:"image"|'image'|image)\]`;
  const imageWrapperPattern = new RegExp(
    `${SELECTOR_LEADING_BOUNDARY}(?:span)?${imageAttrPattern}((?:\\[[^\\]]+\\])*)`
      + SELECTOR_TRAILING_BOUNDARY,
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
      new RegExp(
        String.raw`:has\(\s*>\s*em\s*>\s*(span:first-child\s*\+\s*)?`
          + `(${inlineElementPattern})((?::(?:only-child|first-child|last-child))*)`
          + String.raw`\s*\)`,
        'gi'
      ),
      (_match: string, _plainPrefix: string, element: string, pseudos: string) => `:has(>${element}${pseudos})`
    )
    .replace(
      new RegExp(
        String.raw`:has\(\s*span:first-child\s*\+\s*`
          + `(${inlineElementPattern})((?::(?:only-child|first-child|last-child))*)`
          + String.raw`\s*\)`,
        'gi'
      ),
      (_match: string, element: string, pseudos: string) => `:has(>${element}${pseudos})`
    )
    .replace(
      new RegExp(
        String.raw`:has\(\s*`
          + `(${inlineElementPattern})((?::(?:only-child|first-child|last-child))*)`
          + String.raw`\s*\+\s*span:last-child\s*\)`,
        'gi'
      ),
      (_match: string, element: string, pseudos: string) => `:has(>${element}${pseudos})`
    )
    .replace(
      new RegExp(
        String.raw`>\s*span:first-child\s*\+\s*`
          + `(${inlineElementPattern})((?::(?:only-child|first-child|last-child))*)`
          + SELECTOR_TRAILING_BOUNDARY,
        'gi'
      ),
      (_match: string, element: string, pseudos: string) => `>${element}${pseudos}`
    )
    .replace(
      new RegExp(
        String.raw`((?:th|td)(?::[a-z-]+(?:\([^)]*\))?)*)\s*>\s*span\s*>\s*`
          + `(${inlineElementPattern})((?::(?:only-child|first-child|last-child))*)`,
        'gi'
      ),
      (_match: string, cellSelector: string, element: string, pseudos: string) =>
        `${cellSelector} ${element}${pseudos}`
    )
    .replace(
      new RegExp(
        String.raw`(:is\([^)]*\))\s*>\s*span\s*>\s*`
          + `(${inlineElementPattern})((?::(?:only-child|first-child|last-child))*)`,
        'gi'
      ),
      (_match: string, cellSelector: string, element: string, pseudos: string) =>
        `${cellSelector} ${element}${pseudos}`
    );

  return result;
}
