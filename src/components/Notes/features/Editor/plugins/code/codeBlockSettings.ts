import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { selectCodeBlockLineNumbersEnabled } from '@/stores/unified/settings/markdownSettings';
import type { CodeBlockAttrs } from './types';

export function getDefaultCodeBlockLineNumbers() {
  return selectCodeBlockLineNumbersEnabled(useUnifiedStore.getState());
}

export function createCodeBlockAttrs(
  overrides: Partial<CodeBlockAttrs> = {}
): CodeBlockAttrs {
  return {
    language: null,
    lineNumbers: getDefaultCodeBlockLineNumbers(),
    wrap: false,
    collapsed: false,
    ...overrides,
  };
}
