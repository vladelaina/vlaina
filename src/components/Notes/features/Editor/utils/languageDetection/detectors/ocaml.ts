import type { LanguageDetector } from '../types';

export const detectOCaml: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

  if (/^function\s+/.test(firstLine)) {
    if (/^%\s/m.test(first100Lines) ||
        /^function\s+\w+\s*=\s*\w+\s*\(/m.test(first100Lines)) {
      return null;
    }
  }

  if (/^import\s+(scala|math)\./m.test(first100Lines)) {
    return null;
  }

  if (/\b(def|var)\s+\w+/.test(first100Lines)) {
    if (/\b(trans|Picture|object\s+\w+|println)\b/.test(code)) {
      return null;
    }
  }

  if (/^(namespace|module)\s+[A-Z][\w.]*\s*$/m.test(first100Lines)) {
    return null;
  }

  if (/^package\s+[\w.]+$/m.test(first100Lines)) {
    if (/\b(fun\s+\w+|class\s+\w+|object\s+\w+)\b/.test(first100Lines)) {
      return null;
    }
  }

  if (/\bdef\s+\w+/.test(first100Lines) && /\bend\b/.test(code)) {

    if (/^class\s+\w+|^module\s+\w+|@\w+|sig\s*\{/.test(first100Lines)) {
      return null;
    }
  }

  if (/\b(use\s+\w+::|fn\s+\w+|impl\b|pub\s+fn\b|let\s+mut\b)\b/.test(first100Lines)) {
    return null;
  }

  if (/^package\s+\w+/m.test(first100Lines)) {
    return null;
  }
  if (/^(func|var|const)\s+\w+/m.test(first100Lines)) {
    return null;
  }

  if (/\(\*[\s\S]*?\*\)/.test(first100Lines)) {

    if (/\b(let|match|type|module|open|functor|val|in|begin|end)\b/.test(code)) {
      return 'ocaml';
    }
  }

  if (/\blet\s+rec\s+\w+/.test(code)) {
    return 'ocaml';
  }

  if (/\bfunctor\b/.test(code)) {
    return 'ocaml';
  }

  if (/\bmodule\s+type\s+[A-Z]\w*/.test(code)) {
    return 'ocaml';
  }

  if (/\bsig\b[\s\S]*?\bend\b/.test(code)) {
    return 'ocaml';
  }

  if (/\bstruct\b[\s\S]*?\bend\b/.test(code)) {
    return 'ocaml';
  }

  if (/\|\s*\w+\s*->/.test(code)) {

    if (/\b(let|match)\b/.test(code)) {
      return 'ocaml';
    }
  }

  if (/\bmatch\s+\w+\s+with\b/.test(code)) {
    return 'ocaml';
  }

  if (/\btype\s+\w+\s*=/.test(code)) {

    if (/\|\s*\w+|\bof\b|\bbegin\b|\bend\b/.test(code)) {
      return 'ocaml';
    }
  }

  if (/\bval\s+\w+\s*:/.test(code)) {
    return 'ocaml';
  }

  return null;
};
