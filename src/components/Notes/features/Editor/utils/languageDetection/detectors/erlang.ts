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

  if (/\blists:(filter|map|foldl|foldr|foreach|any|all)\s*\(/.test(code)) {
    return 'erlang';
  }

  // Erlang function definition with pattern matching
  if (/^\w+\([^)]*\)\s*->/m.test(code)) {
    // Check if it ends with a period (Erlang requirement)
    if (/\.\s*$/.test(code.trim())) {
      return 'erlang';
    }
    // Check for Erlang-specific patterns
    if (/\bfun\s*\(\w+\)\s*->/.test(code) || /;$/.test(code.trim())) {
      return 'erlang';
    }
  }

  return null;
};
