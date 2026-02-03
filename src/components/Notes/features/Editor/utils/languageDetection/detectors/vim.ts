import type { LanguageDetector } from '../types';

export const detectVim: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/^use\s+(strict|warnings|lib)\b/m.test(first100Lines) ||
      /^package\s+[\w:]+;/m.test(first100Lines) ||
      /^=head\d+\s+/m.test(first100Lines)) {
    return null;
  }

  if (/#import\s+["<]/.test(first100Lines)) {
    return null;
  }

  if (/\b(proc|method|iterator|template|macro)\s+\w+/.test(first100Lines)) {
    return null;
  }

  if (/\{%\s*(extends|block|macro|set|import)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(import|export)\s+.*\s+from\s+['"]/.test(first100Lines)) {
    return null;
  }

  // Exclude JavaScript files
  if (/\b(var|const)\s+\w+\s*=/.test(first100Lines) ||
      /\bObject\.(defineProperty|create|setPrototypeOf)/.test(first100Lines) ||
      (/\/\*[\s\S]*?\*\//.test(first100Lines) && /\bfunction\s+\w+/.test(first100Lines))) {
    return null;
  }

  if (/\blet\s+\w+\s*=/.test(first100Lines)) {

    if (!/\b(set|filetype|syntax|Plugin|call|function!|endfunction|colorscheme)\b/.test(first100Lines)) {
      return null;
    }
  }

  if (/^"\s*Vimball\s+Archiver/m.test(first100Lines) || /^UseVimball\s*$/m.test(first100Lines)) {
    return 'viml';
  }

  if (/\b(function!?|fun!?)\s+\w+\(/.test(code) && /\b(endfunction|endfun)\b/.test(code)) {
    return 'viml';
  }

  if (/\blet\s+[gbslwtav]:\w+/.test(code)) {
    return 'viml';
  }

  if (/\bautocmd\s+\w+/.test(code)) {
    return 'viml';
  }

  if (/\bcall\s+\w+#\w+\(/.test(code) || /\bcall\s+\w+\(/.test(code)) {

    if (/\b(set|let|if|endif|function|endfunction)\b/.test(code)) {
      return 'viml';
    }
  }

  if (/\bPlugin\s+["']/.test(code)) {
    return 'viml';
  }

  const setCount = (code.match(/\bset\s+(no)?[\w]+/g) || []).length;
  if (setCount >= 3) {
    return 'viml';
  }

  if (/\bset\s+(encoding|filetype|syntax|background|colorscheme|number|autoread|backspace|tabstop|hlsearch|ignorecase|incsearch|modelines|showmatch|laststatus|statusline|rtp)\b/.test(code)) {
    return 'viml';
  }

  if (/\b(nmap|vmap|imap|nnoremap|vnoremap|inoremap|noremap)\s+/.test(code)) {
    return 'viml';
  }

  if (/\bsyntax\s+(on|off|enable|match|region|keyword)/.test(code)) {
    return 'viml';
  }

  if (/\bcolorscheme\s+\w+/.test(code)) {
    return 'viml';
  }

  if (/\bhi(ghlight)?!\s+\w+/.test(code)) {
    return 'viml';
  }

  if (/\bexe(cute)?\s+["']/.test(code)) {

    if (/\b(let|set|hi|highlight)\b/.test(code)) {
      return 'viml';
    }
  }

  return null;
};
