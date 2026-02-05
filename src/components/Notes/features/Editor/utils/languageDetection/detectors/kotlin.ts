import type { LanguageDetector } from '../types';

export const detectKotlin: LanguageDetector = (ctx) => {
  const { sample, first100Lines, hasCurlyBraces, hasSemicolon, code, lines } = ctx;

  // Simple single-line Kotlin patterns
  if (lines.length <= 3) {
    if (/^println\s*\(/.test(code.trim())) {
      // Check for Julia-specific patterns (^ operator)
      if (/\^\d+/.test(code)) {
        return null; // Let Julia detector handle it
      }
      return 'kotlin';
    }
  }

  if (/\bdata\s+class\s+\w+\s*\(/.test(first100Lines)) {
    if (/\bval\s+\w+:\s*\w+/.test(first100Lines)) {
      return 'kotlin';
    }
    return 'kotlin';
  }

  if (!hasCurlyBraces) {
    return null;
  }

  if (/^package\s+\w+$/m.test(first100Lines) && /\bfunc\s+\w+/.test(first100Lines)) {
    return null;
  }

  if (/\b(defmodule|defp|def\s+\w+.*\s+do\b)\b/.test(first100Lines)) {
    return null;
  }

  if (/\bval\s+\w+\s*=\s*\w+\.groupBy\s*\{/.test(code)) {
    if (/\bit\.\w+/.test(code) || /\bmapValues\s*\{/.test(code)) {
      return 'kotlin';
    }
  }

  if (/\bsealed\s+class\s+\w+</.test(code)) {
    if (/\bdata\s+class\s+\w+</.test(code) || /\bobject\s+\w+\s*:/.test(code)) {
      return 'kotlin';
    }
  }

  if (/\binline\s+fun\s+<reified\s+T>/.test(code)) {
    return 'kotlin';
  }

  if (/\b(val|var)\s+\w+\s*=.*\.(filter|map)\s*\{/.test(first100Lines)) {
    if (/\bit\.\w+/.test(first100Lines) || /\{ it\./.test(first100Lines) || /\brepository\./.test(first100Lines) || /\bdata\s+class\b/.test(first100Lines)) {
      return 'kotlin';
    }
  }

  if (/\bval\s+\w+\s*=\s*\w+\.\w+\(\)\.filter\s*\{/.test(code)) {
    if (/\bit\.\w+/.test(code) || /\brepository\./.test(code)) {
      return 'kotlin';
    }
  }

  if (/\bsuspend\s+fun\s+/.test(first100Lines)) {
    return 'kotlin';
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
