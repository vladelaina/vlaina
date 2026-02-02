import type { LanguageDetector } from '../types';

export const detectScala: LanguageDetector = (ctx) => {
  const { sample, first100Lines, hasCurlyBraces, firstLine, lines, code } = ctx;

  if (/:=/.test(first100Lines) && /^\t/m.test(code)) {
    return null;
  }

  if (/^use\s+(self|borrow|clone|cmp|default|fmt|hash|iter|marker|mem|ops|option)::/m.test(first100Lines)) {
    return null;
  }

  if (/\b(let\s+\w+\s*=.*\s+in\b|module\s+\w+\s*=|open\s+[A-Z][\w.]*)\b/.test(first100Lines) ||
      /\(\*[\s\S]*?\*\)/.test(first100Lines) ||
      (/^let\s+\w+\s*=/m.test(first100Lines) && /\(\*/.test(first100Lines))) {
    return null;
  }

  if (/\b(val|def|var)\s+\w+/.test(code)) {

    if (/\b(trans|Picture|draw|forward|right|left|repeat)\s*\(/.test(code) ||
        /\b(switchToDefault2Perspective|newMp3Player|GPics|rot|scale|brit)\s*\(/.test(code)) {

      if (/^def\s+\w+\s*\([^)]*\)\s*:/m.test(first100Lines)) {

      } else {
        return 'scala';
      }
    }
  }

  if (/\bfrom\s+\w+\s+import\b/.test(first100Lines)) {
    return null;
  }

  if (/\bdef\s+\w+\s*\(.*\)\s*:/.test(first100Lines)) {

    if (!/\w+\s*:\s*[A-Z]\w+/.test(first100Lines)) {
      return null;
    }
  }
  if (/^def\s+\w+\s*\([^)]*\)\s*:$/m.test(code) ||
      (/^def\s+\w+\s*\(/m.test(first100Lines) && /^\s{4,}\w+/.test(code))) {
    return null;
  }

  if (/\b(var\s+\w+\s*=|function\s+\w+|console\.|document\.|window\.|require\(|module\.exports|alert\(|constructor\s*\()\b/.test(first100Lines)) {
    return null;
  }

  if (/^package\s+\w+$/m.test(first100Lines) && /\b(func\s+\w+|import\s+\()\b/.test(first100Lines)) {
    return null;
  }

  if (!hasCurlyBraces && /^[\w-]+\s*$/m.test(first100Lines) && /^\s+[\w-]+\s+/.test(first100Lines)) {
    return null;
  }

  if (/#include\s*[<"]/.test(first100Lines)) {
    return null;
  }

  if (firstLine.includes('exec scala')) {
    return 'scala';
  }

  if (/\b(import\s+scala\.|import\s+math\.|package\s+object)\b/.test(first100Lines)) {
    return 'scala';
  }

  if (/\b(name|version|organization|libraryDependencies)\s*:=/.test(first100Lines)) {
    return 'scala';
  }

  if (hasCurlyBraces) {

    if (/\b(object\s+\w+\s+(extends|with)|trait\s+\w+|case\s+class)\b/.test(first100Lines)) {
      return 'scala';
    }

    if (/\bdef\s+\w+\s*(\(.*\))?\s*:\s*\w+/.test(first100Lines)) {
      return 'scala';
    }

    if (/\b(val|var)\s+\w+\s*:\s*\w+/.test(first100Lines)) {
      if (sample.includes('<-') ||
          /\b(extends|with|implicit|sealed|match\s*\{)\b/.test(first100Lines)) {
        return 'scala';
      }
    }

    if (/\b(val|var|def)\s+\w+/.test(code)) {
      if (/\b(collection\.(mutable|immutable)|Vector2D|PicShape|Picture\{)\b/.test(code) ||
          /\b(repeat|forward|right|draw|trans|GPics|rot|scale|brit)\s*\(/.test(code)) {
        return 'scala';
      }
    }
  }

  if (/^import\s+(scala|math)\./m.test(first100Lines)) {
    if (/\b(object\s+\w+|def\s+\w+|val\s+\w+|println\()\b/.test(first100Lines)) {
      return 'scala';
    }
  }

  return null;
};
