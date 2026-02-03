import type { LanguageDetector } from '../types';

export const detectPug: LanguageDetector = (ctx) => {
  const { code, lines, first100Lines } = ctx;

  if (/</.test(code)) {
    return null;
  }

  if (/\b(proc|iterator|template|macro)\s+\w+/.test(first100Lines)) {
    return null;
  }

  if (/\b(def\s+\w+|class\s+\w+|module\s+\w+|require|attr_accessor|attr_reader)\b/.test(first100Lines) && /\bend\b/.test(code)) {
    return null;
  }

  if (/->|=>/.test(code) && /\b(class|for\s+\w+\s+in)\b/.test(first100Lines)) {
    return null;
  }

  if (/^\(ns\s+|^\(def\s+|^\(defn\s+/.test(first100Lines)) {
    return null;
  }

  if (/^(html|head|body|div|span|p|a|img|script|style|link|meta|h[1-6]|ul|ol|li|table|tr|td|form|input|button|nav|header|footer|section|article)\b/m.test(code)) {

    if (/\([\w-]+=['"]|#[\w-]+|\.[\w-]+/.test(code)) {

      if (lines.some(l => /^\s{2,}/.test(l))) {
        return 'pug';
      }
    }

    if (/^[a-z]+\.\s*$/m.test(code)) {
      return 'pug';
    }
  }

  if (/^[a-z]+\.\s*$/m.test(code)) {
    return 'pug';
  }

  if (/[#!]\{[\s\S]*?\}/.test(code)) {

    if (/^(html|head|body|div|span|p|a|img|script|style|link|meta|h[1-6])\b/m.test(code)) {
      return 'pug';
    }
  }

  return null;
};
