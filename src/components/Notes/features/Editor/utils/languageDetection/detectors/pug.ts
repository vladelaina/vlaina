import type { LanguageDetector } from '../types';

export const detectPug: LanguageDetector = (ctx) => {
  const { code, lines, first100Lines } = ctx;

  // Simple single-line Pug patterns: h1 Hello World
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // Pug tag followed by text (no angle brackets)
    if (/^(h[1-6]|p|div|span|a|li|td|th|button|label)\s+[A-Z]/.test(trimmed)) {
      return 'pug';
    }
    // Pug tag with class or id: div.container or div#main
    if (/^(h[1-6]|p|div|span|a|li|td|th|button|label)[.#][\w-]+/.test(trimmed)) {
      return 'pug';
    }
  }

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

  // Pug doctype and basic structure
  if (/^doctype\s+html/mi.test(code)) {
    return 'pug';
  }

  // Pug HTML tags without angle brackets
  if (/^(html|head|body|div|span|p|a|img|script|style|link|meta|h[1-6]|ul|ol|li|table|tr|td|form|input|button|nav|header|footer|section|article)\b/m.test(code)) {
    // Check for Pug-specific syntax
    if (/:\s*(each|if)\s+\w+\s+in\s+\w+/.test(code)) {
      return 'pug';
    }

    // Pug attributes or classes
    if (/\([\w-]+=['"]|#[\w-]+|\.[\w-]+/.test(code)) {
      // Check for indentation (Pug uses indentation)
      if (lines.some(l => /^\s{2,}/.test(l))) {
        return 'pug';
      }
    }

    // Pug tag with dot (self-closing)
    if (/^[a-z]+\.\s*$/m.test(code)) {
      return 'pug';
    }

    // Pug each loop
    if (/^\s+each\s+\w+\s+in\s+\w+/m.test(code)) {
      return 'pug';
    }
  }

  if (/[#!]\{[\s\S]*?\}/.test(code)) {

    if (/^(html|head|body|div|span|p|a|img|script|style|link|meta|h[1-6])\b/m.test(code)) {
      return 'pug';
    }
  }

  return null;
};
