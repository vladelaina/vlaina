import type { LanguageDetector } from '../types';

export const detectJulia: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

  if (/^use\s+(strict|warnings|lib)\b/m.test(first100Lines) ||
      /^package\s+[\w:]+;/m.test(first100Lines) ||
      /^=head\d+\s+/m.test(first100Lines)) {
    return null;
  }

  if (/^module\s+[A-Z]\w*$/m.test(first100Lines) &&
      /\bdef\s+\w+/.test(first100Lines) &&
      /\bend\b/.test(code)) {
    return null;
  }

  if (/\b(import|export|const|let|var|function|class)\s+/.test(first100Lines) && /[{}]/.test(first100Lines)) {
    return null;
  }

  if (/^\[[\w.-]+\]\s*$/m.test(code)) {
    return null;
  }

  if (/^[\w-]+\s*=\s*[^=]/m.test(code) && !/\bfunction\b|\bend\b/.test(first100Lines)) {
    return null;
  }

  if (/^function\s+\w+\s*\(/m.test(first100Lines) && /\bend\b/.test(code)) {

    if (/^##/.test(first100Lines) ||
        /\b(zeros|ones|rand|randn|println|using|module)\b/.test(first100Lines) ||
        /\[[\d\s.]+\]/.test(first100Lines)) {
      return 'julia';
    }
  }

  if (/\b(module|using|import)\s+[A-Z]\w*/.test(first100Lines)) {
    if (/\bfunction\b|\bend\b/.test(code)) {
      return 'julia';
    }
  }

  if (/@\w+/.test(code) && /\bfunction\b.*\bend\b/.test(code)) {

    if (!/\b(defmodule|def|defp)\b/.test(first100Lines)) {
      return 'julia';
    }
  }

  if (/::[A-Z]\w*/.test(code) && /\bfunction\b|\bend\b/.test(code)) {
    return 'julia';
  }

  if (/\w+\[[\d:,\s]+\]\s*=/.test(code) && /\bfunction\b|\bend\b/.test(code)) {
    return 'julia';
  }

  return null;
};
