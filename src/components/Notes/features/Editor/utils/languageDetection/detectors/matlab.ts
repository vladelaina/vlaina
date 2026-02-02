import type { LanguageDetector } from '../types';

export const detectMatlab: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

  if (/^function\s+/.test(firstLine)) {

    if (/^%\s/m.test(first100Lines) || /\bend\b/.test(code)) {
      return 'matlab';
    }
  }

  if (/\b(import|export|const|let|var)\s+/.test(first100Lines) && /[{}]/.test(first100Lines)) {
    return null;
  }

  if (/^%[\w.#]/.test(firstLine) || /^%[\w.#]/m.test(first100Lines)) {
    return null;
  }

  if (/^\[[\w.-]+\]\s*$/m.test(code)) {
    return null;
  }

  if (/\b(let\s+\w+\s*=|type\s+\w+\s*=|module\s+\w+\s*=)\b/.test(first100Lines) && /\b(in\b|end\b|;;)/.test(code)) {
    return null;
  }

  if (/^function\s+\w+\s*=\s*\w+\s*\(/m.test(first100Lines)) {
    return 'matlab';
  }

  if (/^function\s+\w+\s*\(/m.test(first100Lines)) {

    if (/%\s/.test(first100Lines) && /\bend\b/.test(code)) {
      return 'matlab';
    }
  }

  if (/^%\s/m.test(first100Lines) && /\bfunction\b/.test(first100Lines) && /\bend\b/.test(code)) {
    return 'matlab';
  }

  if (/\b(disp|fprintf|size|length|zeros|ones|eye|rand|randn|error)\s*\(/.test(first100Lines)) {
    if (/\bfunction\b|\bend\b/.test(code)) {
      return 'matlab';
    }
  }

  if (/\[[\w,\s]+\]\s*=\s*size\(/.test(code)) {
    return 'matlab';
  }

  if (/^for\s+\w+\s*=\s*[\d:]+/m.test(code) && /\bend\b/.test(code)) {

    if (/\b(linspace|zeros|ones|figure|pcolor|shading)\s*\(/.test(code)) {
      return 'matlab';
    }
  }

  return null;
};
