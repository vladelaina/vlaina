import type { LanguageDetector } from '../types';

export const detectProlog: LanguageDetector = (ctx) => {
  const { code, first100Lines, lines } = ctx;

  if (/\b(import|export|const|let|var|function|def|class)\b/.test(first100Lines)) {
    return null;
  }

  if (/#include\s*[<"]/.test(first100Lines)) {
    return null;
  }

  if (/^package\s+\w+/.test(first100Lines)) {
    return null;
  }

  if (/^:-\s+(module|use_module|dynamic|multifile|discontiguous)\b/.test(first100Lines)) {
    return 'prolog';
  }

  if (/\b(length|append|member|reverse|sort|findall|bagof|setof|assert|retract|consult|write|read|nl|fail|true|is)\s*\(/.test(code)) {
    if (/\.$/.test(code.trim())) {
      return 'prolog';
    }
  }

  if (/^\w+\([^)]*\)\s*:-/.test(first100Lines)) {
    return 'prolog';
  }

  if (/^\w+\([^)]*\)\.$/m.test(code)) {
    if (lines.length <= 3 && !/;/.test(code)) {
      return 'prolog';
    }
    // Multi-line facts
    if (lines.filter(l => /^\w+\([^)]*\)\.$/.test(l.trim())).length >= 2) {
      return 'prolog';
    }
  }

  if (/\?-\s*\w+/.test(code)) {
    return 'prolog';
  }

  return null;
};
