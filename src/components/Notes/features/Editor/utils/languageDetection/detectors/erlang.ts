import type { LanguageDetector } from '../types';

export const detectErlang: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

  if (/^use\s+(strict|warnings|v\d+)/m.test(first100Lines) || /^package\s+[\w:]+;/m.test(first100Lines)) {
    return null;
  }

  if (/\{%[\s\S]*?%\}/.test(first100Lines)) {
    return null;
  }

  if (/^%.*-\*-\s*erlang\s*-\*-/m.test(first100Lines)) {
    return 'erlang';
  }

  if (/^\{application,\s*\w+,/m.test(code)) {
    return 'erlang';
  }

  if (/^(Nonterminals|Terminals)\b/m.test(first100Lines)) {
    return 'erlang';
  }

  if (/^#!.*\bescript\b/.test(firstLine)) {
    return 'erlang';
  }

  if (/^-module\(\w+\)\./m.test(code)) {
    return 'erlang';
  }

  if (/^-export\(\[[\s\S]*?\]\)\./m.test(code)) {
    return 'erlang';
  }

  if (/^-include\(["'][\w\/]+\.hrl["']\)\./m.test(code)) {
    return 'erlang';
  }

  if (/^\w+\([^)]*\)\s*->/m.test(code) && /\.$/.test(code.trim())) {
    return 'erlang';
  }

  return null;
};
