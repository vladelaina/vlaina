import type { LanguageDetector } from '../types';

export const detectLua: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

  if (/^---\s*$/.test(firstLine) && /^uti:\s*com\./m.test(first100Lines)) {
    return null;
  }

  if (/^"\s/m.test(first100Lines) &&
      (/\b(function!|endfunction|set\s+\w+|colorscheme|autocmd|let\s+[gbslwtav]:)\b/.test(first100Lines))) {
    return null;
  }

  if (/^"\s*Vimball\s+Archiver/m.test(first100Lines) || /^UseVimball\s*$/m.test(first100Lines)) {
    return null;
  }

  if (/\b(import|export)\s+/.test(first100Lines) ||
      /\b(var|const|let)\s+\w+\s*=/.test(first100Lines) ||
      /\bObject\.(defineProperty|create|setPrototypeOf)/.test(first100Lines)) {
    return null;
  }

  if (/^function\s+\w+\s*\(/m.test(first100Lines) && (/^##/m.test(first100Lines) || /\[[\d\s.]+\]/.test(first100Lines))) {
    return null;
  }

  if (/\bpackage\s*=\s*["']/.test(first100Lines) && /\bsource\s*=\s*\{/.test(first100Lines)) {
    return 'lua';
  }

  if (/\b(local|function|end|then|elseif|repeat|until)\b/.test(code)) {

    if (/\bfunction\s+\w+\s*\(.*\)|local\s+\w+\s*=/.test(code)) {
      return 'lua';
    }
  }

  if (/\{[\s\S]*?\}/.test(code) && /\[["']\w+["']\]\s*=/.test(code)) {
    return 'lua';
  }

  if (/--\[\[[\s\S]*?\]\]|^--\s/m.test(code)) {
    if (/\b(local|function|end)\b/.test(code)) {
      return 'lua';
    }
  }

  return null;
};
