import {
  normalizeCodeMirrorElementAliases,
  normalizeContentElementAliases,
  normalizeInlineElementAliases,
  normalizeTaskCheckboxAliases,
} from '../selectorAliases';
import { splitSelectorList } from '../selectorList';
import { normalizeFunctionalRootAliases } from './functionalRootAliases';
import { scopeLeadingRootSelector } from './rootAliases';

export function scopeSelectorList(selectorList: string, scopeSelector: string): string {
  return splitSelectorList(selectorList)
    .map((selector) => scopeSingleSelector(selector, scopeSelector))
    .join(',\n');
}

export function addRootStateClassToSelectorList(
  selectorList: string,
  scopeSelector: string,
  rootStateClass: string
): string {
  return splitSelectorList(selectorList)
    .map((selector) => addRootStateClassToSelector(selector, scopeSelector, rootStateClass))
    .join(',\n');
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
  const rootStatePattern = new RegExp(
    `^${escapeRegExp(rootStateClass)}(?=$|[.#:[>+~\\s])`,
    'i'
  );

  if (rootStatePattern.test(afterScope)) {
    return trimmed;
  }

  return `${scopeSelector}${rootStateClass}${afterScope}`;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
