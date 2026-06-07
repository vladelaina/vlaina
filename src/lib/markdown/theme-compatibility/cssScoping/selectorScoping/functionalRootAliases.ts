import { selectorTargetsImportedPageChrome } from '../../selectorClassification';
import { findMatchingParen, splitSelectorList } from '../selectorList';
import {
  foldNestedLeadingRootSelector,
  MARKDOWN_WRAPPER_ALIAS_PATTERN,
} from './rootAliases';

const SELECTOR_LIST_FUNCTION_PATTERN = /^:((?:-webkit-|-moz-)?(?:is|where|not|has|any|matches))\(/i;
const POSITIVE_SELECTOR_LIST_FUNCTION_PATTERN = /^(?:-webkit-|-moz-)?(?:is|where|has|any|matches)$/i;
const SIMPLIFIABLE_SELECTOR_LIST_FUNCTION_PATTERN = /^(?:-webkit-|-moz-)?(?:is|where|any|matches)$/i;

export function normalizeFunctionalRootAliases(selector: string): string {
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
    const renderedFunction = renderSelectorListFunction(match[1], finalArguments, normalizedInner);

    result += selector.slice(segmentStart, index);
    result += renderedFunction;
    index = closeParenIndex;
    segmentStart = closeParenIndex + 1;
  }

  return result + selector.slice(segmentStart);
}

function renderSelectorListFunction(
  functionName: string,
  finalArguments: string[],
  normalizedInner: string
): string {
  if (SIMPLIFIABLE_SELECTOR_LIST_FUNCTION_PATTERN.test(functionName) && finalArguments.length === 1) {
    return finalArguments[0];
  }

  return `:${functionName}(${normalizedInner})`;
}

function selectorTargetsOnlyMarkdownRootWrapperAlias(selector: string): boolean {
  return Boolean(selector.trim().match(MARKDOWN_WRAPPER_ALIAS_PATTERN));
}
