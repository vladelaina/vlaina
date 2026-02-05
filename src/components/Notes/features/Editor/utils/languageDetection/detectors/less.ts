import type { LanguageDetector } from '../types';

export const detectLess: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  // Exclude Swift (strong Swift indicators)
  if (/@State\s+(private\s+)?var\s+\w+/.test(first100Lines) ||
      /struct\s+\w+:\s*View\s*\{/.test(first100Lines) ||
      /\bvar\s+body:\s*some\s+View/.test(first100Lines)) {
    return null;
  }

  // Exclude Dart/Flutter (strong Dart indicators)
  if (/class\s+\w+\s+extends\s+(StatefulWidget|StatelessWidget)/.test(first100Lines) ||
      /class\s+_\w+State\s+extends\s+State</.test(first100Lines) ||
      /@override\s+Widget\s+build/.test(first100Lines)) {
    return null;
  }

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

  if (/@[\w-]+:\s*#[0-9a-fA-F]{3,6};/.test(code) && /\.[\w-]+\s*\{/.test(code)) {
    if (/&:hover/.test(code) && /darken\s*\(@/.test(code)) {
      return 'less';
    }
    return 'less';
  }

  if (/@[\w-]+:\s*#[0-9a-fA-F]{3,6};/.test(code) && /\.[\w-]+\s*\{/.test(code) && /&:hover/.test(code)) {
    if (/darken\s*\(@[\w-]+/.test(code)) {
      return 'less';
    }
  }

  if (/\.[\w-]+\([^)]*\)\s*\{/.test(code) && /@[\w-]+/.test(code)) {
    return 'less';
  }

  return null;
};
