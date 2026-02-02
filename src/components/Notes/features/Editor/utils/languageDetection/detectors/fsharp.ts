import type { LanguageDetector } from '../types';

export const detectFSharp: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

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

  if (/\b(let\s+mutable|let\s+rec|match\s+\w+\s+with|type\s+\w+\s*=|module\s+[A-Z])\b/.test(first100Lines)) {
    return 'fsharp';
  }

  if (/\|\s*\w+\s*->/.test(code) && /\blet\b/.test(code)) {
    return 'fsharp';
  }

  if (/\b(async|seq|query)\s*\{/.test(code)) {
    if (/\blet\b/.test(code)) {
      return 'fsharp';
    }
  }

  if (/\|>/.test(code) && /\blet\b/.test(code)) {
    return 'fsharp';
  }

  return null;
};
