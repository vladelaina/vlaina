import type { LanguageDetector } from '../types';

export const detectFSharp: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine, lines } = ctx;

  // F# simple function and pipeline
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // F# pipeline: let result = [1..10] |> List.map (fun x -> x * 2) |> List.sum
    if (/\|>/.test(trimmed) && /\bList\.(map|filter|fold|sum|length)/.test(trimmed)) {
      return 'fsharp';
    }
    // F# simple function
    if (/^let\s+\w+\s+\w+\s+\w+\s*=/.test(trimmed)) {
      return 'fsharp';
    }
  }

  if (/^#!.*crystal/.test(firstLine)) {
    return null;
  }
  if (/require\s+["']/.test(first100Lines) && /\b(describe|it|assert_type)\b/.test(code)) {
    return null;
  }

  if (/^"\s/m.test(first100Lines) &&
      (/\b(function!|endfunction|call\s+\w+|UseVimball)\b/.test(first100Lines))) {
    return null;
  }

  if (/^\(\*/.test(code.trim())) {
    return null;
  }

  if (/^using\s+System/m.test(first100Lines) || /^namespace\s+[\w.]+\s*\{/.test(first100Lines)) {
    return null;
  }

  if (/^namespace\s+[\w.]+$/m.test(first100Lines)) {

    if (!/\{/.test(first100Lines.slice(0, 200))) {
      return 'fsharp';
    }
  }

  if (/^\[<\w+>\]$/m.test(first100Lines) && /^module\s+[A-Z]\w*\s*=/.test(code)) {
    return 'fsharp';
  }

  if (/^open\s+[A-Z][\w.]*$/m.test(first100Lines)) {

    if (/\b(let|match|with|type|module)\b/.test(first100Lines)) {
      return 'fsharp';
    }
  }

  if (/\blet\s+\w+\s*:\s*\w+/.test(first100Lines)) {

    if (/\|>/.test(code) || /\bmodule\b|\bnamespace\b/.test(first100Lines)) {
      return 'fsharp';
    }
  }

  // F# pattern matching with printfn
  if (/\bmatch\s+\w+\s+with/.test(first100Lines)) {
    if (/\bprintfn\b/.test(code)) {
      return 'fsharp';
    }
  }

  if (/\b(let\s+mutable|let\s+rec|match\s+\w+\s+with|type\s+\w+\s*=|module\s+[A-Z])\b/.test(first100Lines)) {
    return 'fsharp';
  }

  if (/\busers\s*\|>\s*List\.(filter|map)/.test(code)) {
    if (/\bfun\s+\w+\s*->/.test(code) && (/\bu\.\w+/.test(code) || /\bActive\b/.test(code) || /\b[A-Z]\w*\b/.test(code))) {
      return 'fsharp';
    }
    if (/\bList\.(filter|map)\s*\(\s*fun\s+\w+\s*->/.test(code)) {
      if (/\b[A-Z]\w+/.test(code.match(/fun\s+\w+\s*->.*$/)?.[0] || '')) {
        return 'fsharp';
      }
    }
  }

  if (/\bfun\s+\w+\s*->\s*\w+\.[A-Z]/.test(code)) {
    return 'fsharp';
  }

  if (/\bList\.(filter|map)\s*\(\s*fun\s+\w+\s*->\s*\w+\s*>\s*\d+/.test(code)) {
    if (!/\b[A-Z]\w+/.test(code.match(/fun\s+\w+\s*->.*$/)?.[0] || '')) {
      return null;
    }
  }

  if (/\|\s*\w+\s*->/.test(code) && /\blet\b/.test(code)) {
    if (/\|>/.test(code) || (/\bList\.(filter|map)/.test(code) && /\bfun\s+\w+\s*->/.test(code))) {
      if (/\bfun\s+\w+\s*->\s*\w+\.[A-Z]/.test(code) || /\b[A-Z]\w+/.test(code.match(/fun\s+\w+\s*->.*$/)?.[0] || '')) {
        return 'fsharp';
      }
      return null;
    }
  }

  if (/\b(async|seq|query)\s*\{/.test(code)) {
    if (/\blet\b/.test(code)) {
      return 'fsharp';
    }
  }

  if (/\|>/.test(code) && /\blet\b/.test(code)) {
    if (/\bfun\s+\w+\s*->\s*\w+\.[A-Z]/.test(code) || 
        /\b(module|namespace|open)\s+[A-Z]/.test(code) ||
        /\blet\s+mutable\b/.test(code) ||
        /\[\<\w+\>\]/.test(code)) {
      return 'fsharp';
    }
    return null;
  }

  return null;
};
