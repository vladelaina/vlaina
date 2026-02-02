import type { LanguageDetector } from '../types';

export const detectLess: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/^package\s+[\w.]+;/m.test(code) || /^import\s+java\./m.test(code)) {
    return null;
  }

  if (/^use\s+\w+::/m.test(first100Lines) || /\/\*!/.test(first100Lines)) {
    return null;
  }

  if (/\b(model|datasource|generator)\s+\w+\s*\{/.test(first100Lines)) {
    return null;
  }

  if (/\b(defmodule|defp|def\s+\w+|@moduledoc|@doc|@spec)\b/.test(first100Lines)) {
    return null;
  }

  if (/@[\w-]+:\s*[^;]+;/.test(code)) {

    const lessVarMatches = code.match(/@[\w-]+:\s*[^;]+;/g) || [];
    const cssAtRuleMatches = code.match(/@(media|import|keyframes|font-face|charset|namespace|supports|page|document)/g) || [];

    if (lessVarMatches.length > cssAtRuleMatches.length) {
      return 'less';
    }

    if (lessVarMatches.length >= 2) {
      return 'less';
    }

    if (/\.[\w-]+\([^)]*\)\s*\{/.test(code)) {
      return 'less';
    }

    if (/@[\w-]+\s*[+\-*/]\s*@[\w-]+/.test(code)) {
      return 'less';
    }

    if (/\b(darken|lighten|saturate|desaturate|fadein|fadeout|fade|spin|mix)\s*\(@/.test(code)) {
      return 'less';
    }
  }

  if (/\.[\w-]+\([^)]*\)\s*\{/.test(code) && /@[\w-]+/.test(code)) {
    return 'less';
  }

  return null;
};
