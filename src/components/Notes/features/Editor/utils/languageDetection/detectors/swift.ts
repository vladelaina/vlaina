import type { LanguageDetector } from '../types';

export const detectSwift: LanguageDetector = (ctx) => {
  const { sample, first100Lines, hasCurlyBraces } = ctx;

  if (/^extends\s+\w+/m.test(first100Lines)) {
    return null;
  }

  // Exclude C/C++ files (has /* */ comments, #include, or typedef)
  if (/^\/\*[\s\S]*?\*\//m.test(first100Lines) ||
      /#include\s*[<"]/.test(first100Lines) ||
      /\btypedef\s+(struct|enum|union)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(import\s+Foundation|import\s+UIKit|import\s+SwiftUI)\b/.test(first100Lines)) {
    return 'swift';
  }

  if (/\b(func\s+\w+|var\s+\w+:\s*\w+|let\s+\w+:\s*\w+|class\s+\w+:\s*\w+|struct\s+\w+|enum\s+\w+|protocol\s+\w+)\b/.test(first100Lines)) {
    if (sample.includes('->') ||
        /\b(guard|defer|mutating|inout|@\w+|extension\s+\w+)\b/.test(first100Lines) ||
        /\?\?|\?\./.test(first100Lines)) {
      return 'swift';
    }
  }

  if (/\\\([\w\s+]+\)/.test(first100Lines)) {
    return 'swift';
  }

  if (/\b(if|guard)\s+let\s+\w+/.test(first100Lines)) {
    return 'swift';
  }

  if (/\b(let|var)\s+\w+\s*=\s*\w+\[\]\(\)/.test(first100Lines)) {
    return 'swift';
  }

  if (/\b(let|var)\s+\w+\s*=\s*Dictionary</.test(first100Lines)) {
    return 'swift';
  }

  if (/\b(var|let)\s+\w+\s*=\s*\[/.test(first100Lines)) {

    if (/\[[\s\n]*"[^"]+"\s*:\s*"[^"]+"\s*[,\]]/.test(first100Lines)) {
      return 'swift';
    }

    if (/\[[\s\n]*"[^"]+"\s*,/.test(first100Lines)) {
      return 'swift';
    }
  }

  if (ctx.lines.length <= 3 && /^\w+\s*=\s*\[\s*\]/.test(first100Lines.trim())) {
    return 'swift';
  }

  if (hasCurlyBraces) {

    if (/\bfor\s+\w+\s+in\s+/.test(first100Lines)) {
      if (/\b(let|var)\s+\w+\s*=/.test(first100Lines)) {
        return 'swift';
      }
    }

    if (/\bswitch\s+\w+\s*\{/.test(first100Lines) && /\bcase\s+/.test(first100Lines)) {
      return 'swift';
    }

    if (/\bdo\s*\{/.test(first100Lines) && /\}\s*while\s+/.test(first100Lines)) {
      return 'swift';
    }
  }

  return null;
};
