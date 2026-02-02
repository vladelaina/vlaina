import type { LanguageDetector } from '../types';

export const detectElm: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

  if (/\b(const|var|export\s+default|export\s+const|import\s+.*from)\s+/.test(first100Lines)) {
    return null;
  }

  if (/\blet\s+/.test(first100Lines) && !/\blet\s+\w+.*\bin\b/.test(code)) {
    return null;
  }

  if (/<-/.test(first100Lines) && /\b(library|function)\b/.test(first100Lines)) {
    return null;
  }

  if (/^[\w-]+:\s*$/m.test(first100Lines) && !/\b(module|import|type|data)\b/.test(first100Lines)) {
    return null;
  }

  if (/^module\s+[A-Z][\w.]*\s+exposing/m.test(first100Lines)) {
    return 'elm';
  }

  const hasDataDecl = /^data\s+[A-Z]\w+(\s+\w+)?\s*=/m.test(first100Lines);
  if (hasDataDecl) {

    if (/\{\w+\s*::\s*/.test(first100Lines)) {
      return null;
    }
    if (/^(module|import)\s+[A-Z]/m.test(first100Lines)) {
      return null;
    }

    if (/\bcase\s+\w+\s+of\b/.test(code)) {
      return 'elm';
    }
    if (/\blet\s+\w+\s*=.*\bin\b/.test(code)) {
      return 'elm';
    }

    if (/^\w+\s*=\s*[^=]/m.test(code) && !/^\w+\s*::\s*/m.test(code)) {
      return 'elm';
    }
  }

  if (/^import\s+[A-Z][\w.]*(\s+exposing|\s+as\s+[A-Z]|\s+\()/m.test(first100Lines)) {

    if (/\b(let|in|case|of|type|type\s+alias)\b/.test(first100Lines)) {
      return 'elm';
    }

    const elmImports = (first100Lines.match(/^import\s+[A-Z][\w.]*/gm) || []).length;
    if (elmImports >= 2) {
      return 'elm';
    }
  }

  if (/^import\s+[A-Z][\w.]*\s*$/m.test(first100Lines)) {
    const elmImports = (first100Lines.match(/^import\s+[A-Z][\w.]*\s*$/gm) || []).length;
    if (elmImports >= 2) {

      if (/\b(let|in|case|of|type|map|filter)\b/.test(code)) {
        return 'elm';
      }
    }
  }

  if (/^\w+\s*:\s*[A-Z][\w.]*(\s*->)?/m.test(first100Lines)) {

    if (/^(module|import)\s+[A-Z]/m.test(first100Lines)) {
      return 'elm';
    }
  }

  if (/\blet\s+\w+\s*=/.test(code) && /\bin\b/.test(code)) {

    if (/^import\s+[A-Z]/m.test(first100Lines)) {
      return 'elm';
    }
  }

  if (/\btype\s+alias\s+\w+\s*=/.test(first100Lines)) {
    return 'elm';
  }

  if (/\bupdate\s*:\s*Msg\s*->/.test(code)) {
    return 'elm';
  }

  if (/\bcase\s+\w+\s+of\b/.test(code)) {

    if (/\w+:\w+\s*->|^\s*\[\]\s*->/m.test(code)) {
      return 'elm';
    }
  }

  if (/^\w+\s+\w+\s*=/m.test(first100Lines)) {

    if (/\bcase\s+\w+\s+of\b/.test(code) || /\+\+/.test(code) || /\basText\b/.test(code)) {
      return 'elm';
    }
  }

  return null;
};
