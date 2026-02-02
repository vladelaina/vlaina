import type { LanguageDetector } from '../types';

export const detectPython: LanguageDetector = (ctx) => {
  const { firstLine, first100Lines, lines, hasCurlyBraces, code } = ctx;

  if (firstLine.startsWith('# -*- coding:') || firstLine.startsWith('# coding:')) {
    return 'python';
  }

  if (/^package\s+[\w:]+;/m.test(first100Lines) ||
      /^use\s+(strict|warnings|lib)\b/m.test(first100Lines) ||
      (/^sub\s+\w+\s*\{/m.test(first100Lines) && /[\$@%][\w]+/.test(first100Lines))) {
    return null;
  }

  if (/^#!.*crystal/.test(firstLine) ||
      /require\s+["'].*spec_helper["']/.test(first100Lines) ||
      (/\bdescribe\s+["']/.test(code) && /\.should\s+(eq|be_true|be_false|be_nil)/.test(code)) ||
      (/^module\s+[A-Z]\w*$/m.test(first100Lines) && /\bdef\s+\w+/.test(first100Lines) && /\bend\b/.test(code))) {
    return null;
  }

  if (/^\(ns\s+[\w.-]+|^\((def|defn|defmacro|deftask)\s+/m.test(first100Lines)) {
    return null;
  }
  if (/^;;/.test(first100Lines) && /^\(/m.test(first100Lines)) {
    return null;
  }

  if (/:\s*(str|int|bool|float|List|Dict|Tuple|Optional|Union|Any|Callable|Type|Sequence|Iterable)\b/.test(first100Lines)) {
    if (/\bdef\s+\w+\s*\(/.test(first100Lines) || /\bclass\s+\w+/.test(first100Lines)) {

      if (/\bfrom\s+typing\s+import\b/.test(first100Lines) || /\bTypeVar\b/.test(first100Lines)) {
        return 'python';
      }
    }
  }

  if (/\bdef\s+(setup|draw)\s*\(\s*\):/.test(code)) {
    return 'python';
  }

  if (/^[\w-]+:\s*$/m.test(code) && /^\t/.test(code)) {

    if (/\bdef\s+\w+\s*\(/.test(first100Lines) || /\bclass\s+\w+/.test(first100Lines)) {
      return 'python';
    }
    return null;
  }

  if (!/[{}]/.test(code) && !/;/.test(code) && /\b(color|background|margin|padding|border|width|height)\s*:/.test(first100Lines)) {

    if (/\bdef\s+\w+\s*\(/.test(first100Lines) || /\bclass\s+\w+/.test(first100Lines) || /\bfrom\s+typing\s+import\b/.test(first100Lines)) {
      return 'python';
    }
    return null;
  }

  if (/\bdef\s+\w+\s*\(/.test(first100Lines)) {

    if (/\bfor\s+\w+\s+in\s+/.test(code) || /\bif\s+.*:/.test(code) || /\bimport\s+\w+/.test(first100Lines)) {
      return 'python';
    }
  }

  if (/\b(defmodule|defp|def\s+\w+.*\s+do\b|use\s+[A-Z]|import\s+[A-Z]|alias\s+[A-Z])\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(extends\s+\w+|signal\s+\w+|export\s*\(|onready\s+var|func\s+_ready\(\))\b/.test(first100Lines)) {
    return null;
  }

  if (!/\b(def\s+\w+|class\s+\w+|import\s+\w+|from\s+\w+\s+import|if\s+.*:|elif\s+.*:|else:|print\(|lambda\s+|with\s+.*:|async\s+def|@\w+\s*\n\s*def)\b/.test(first100Lines)) {
    return null;
  }

  const pythonScore = (
    (/\b(def\s+\w+\s*\(|class\s+\w+\s*:)/.test(first100Lines) ? 2 : 0) +
    (/\b(self|__init__|__name__|__main__|None|True|False|range\(|append\(|len\()\b/.test(first100Lines) ? 2 : 0) +
    (/^(def|class|import|from)\s+/.test(firstLine) ? 1 : 0) +
    (lines.slice(0, 20).filter(l => /^\s{4}|\t/.test(l)).length > 2 ? 1 : 0) +
    (!hasCurlyBraces ? 1 : 0)
  );

  if (pythonScore >= 3) {
    return 'python';
  }

  return null;
};
