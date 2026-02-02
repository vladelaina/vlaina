import type { LanguageDetector } from '../types';

export const detectKotlin: LanguageDetector = (ctx) => {
  const { sample, first100Lines, hasCurlyBraces, hasSemicolon } = ctx;

  if (!hasCurlyBraces) {
    return null;
  }

  if (/^package\s+\w+$/m.test(first100Lines) && /\bfunc\s+\w+/.test(first100Lines)) {
    return null;
  }

  if (/\b(defmodule|defp|def\s+\w+.*\s+do\b)\b/.test(first100Lines)) {
    return null;
  }

  if (/^package\s+[\w.]+$/m.test(first100Lines) && /^import\s+[\w.]+/.test(first100Lines)) {
    if (/\b(fun\s+\w+|val\s+\w+|var\s+\w+:\s*\w+|class\s+\w+|object\s+\w+|interface\s+\w+|data\s+class)\b/.test(first100Lines)) {
      return 'kotlin';
    }
  }

  if (/\b(fun\s+\w+|data\s+class|sealed\s+class|companion\s+object)\b/.test(first100Lines)) {
    if (sample.includes('?.') ||
        sample.includes('!!') ||
        /\b(suspend|inline|reified|when\s*\{)\b/.test(first100Lines) ||
        !hasSemicolon) {
      return 'kotlin';
    }
  }

  return null;
};
