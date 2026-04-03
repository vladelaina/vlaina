import type { LanguageDetector } from '../types';

export const detectOCaml: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine, lines } = ctx;
  const hasLeadingPrintfN = /^\s*printfn\b/m.test(code) || /->\s*printfn\b/.test(code);

  if (
    hasLeadingPrintfN &&
    !/\blet\s+rec\s+\w+/.test(code) &&
    !/\bmatch\s+\w+\s+with\b/.test(code) &&
    !/\btype\s+\w+\s*=/.test(code) &&
    !/\bmodule\s+type\b/.test(code) &&
    !/\bfunctor\b/.test(code)
  ) {
    return null;
  }

  // Simple single-line OCaml patterns
  if (lines.length <= 3) {
    // OCaml single-line function: let square x = x * x
    if (/^let\s+\w+\s+\w+\s*=\s*\w+\s*\*\s*\w+$/.test(code.trim())) {
      return 'ocaml';
    }
  }

  // OCaml recursive function (must be before F# check)
  if (/^let\s+rec\s+\w+/.test(first100Lines)) {
    if (hasLeadingPrintfN) {
      return null;
    }
    return 'ocaml';
  }

  // OCaml function with if/then/else
  if (/\blet\s+rec\s+\w+\s+\w+\s*=/.test(code)) {
    if (/\bif\s+\w+\s*<=/.test(code) && /\bthen\b/.test(code) && /\belse\b/.test(code)) {
      if (hasLeadingPrintfN) {
        return null;
      }
      return 'ocaml';
    }
  }

  if (/\bmatch\s+\w+\s+with/.test(first100Lines) && hasLeadingPrintfN) {
    return null;
  }

  if (/\bdata\s+class\s+\w+\s*\(/.test(first100Lines)) {
    return null;
  }

  if (/\b(val|var)\s+\w+:\s*\w+/.test(first100Lines) && /\bfun\s+\w+/.test(first100Lines)) {
    return null;
  }

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

  if (/^struct\s+[A-Z]\w*\s*$/m.test(first100Lines) && /::[A-Z]\w*/.test(code) && /^end\s*$/m.test(code)) {
    return null;
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

  if (/\bList\.filter\s*\(/.test(code) && /\|>/.test(code)) {
    if (/\bfun\s+\w+\s*->\s*\w+\s*>\s*\d+/.test(code) && !/\b[A-Z]\w*\b/.test(code.match(/fun\s+\w+\s*->.*$/)?.[0] || '')) {
      return 'ocaml';
    }
    return 'ocaml';
  }

  if (/\bList\.(map|fold_left|fold_right)\s*\(/.test(code) && /\bfun\s+\w+\s*->/.test(code)) {
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
      if (!/\bdata\s+class\b/.test(code)) {
        return 'ocaml';
      }
    }
  }

  if (/\bval\s+\w+\s*:/.test(code)) {
    return 'ocaml';
  }

  return null;
};
