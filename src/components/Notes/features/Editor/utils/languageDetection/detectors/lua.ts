import type { LanguageDetector } from '../types';

export const detectLua: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine, lines } = ctx;

  // Simple single-line Lua patterns
  if (lines.length <= 3) {
    if (/^print\s*\(/.test(code.trim())) {
      // Check for Lua-specific patterns
      if (/\blocal\s+\w+|function\s+\w+.*end/.test(code)) {
        return 'lua';
      }
      // If it's just print("string"), let Python handle it (more common)
      return null;
    }
    // Lua local variable declaration
    if (/\blocal\s+\w+\s*=/.test(code)) {
      return 'lua';
    }
  }

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

  if (
    /\b(?:async\s+)?function\s+\w+(?:<[^>\n]+>)?\s*\([^)]*:\s*[^)]+\)\s*:\s*[^({\n]+/.test(code) ||
    /\basserts\s+\w+\s+is\s+\w+/.test(code) ||
    /\bvalue\s+is\s+\w+/.test(code)
  ) {
    return null;
  }

  if (/^function\s+\w+\s*\(/m.test(first100Lines) && (/^##/m.test(first100Lines) || /\[[\d\s.]+\]/.test(first100Lines))) {
    return null;
  }

  if (/\bpackage\s*=\s*["']/.test(first100Lines) && /\bsource\s*=\s*\{/.test(first100Lines)) {
    return 'lua';
  }

  if (/\blocal\s+\w+\s*=\s*(table\.concat|table\.|string\.|math\.|io\.|os\.)/.test(code)) {
    return 'lua';
  }

  if (/\blocal\s+\w+\s*=/.test(code) && /table\./.test(code)) {
    if (!/\bwhere\b|\blet\s+\w+\s*=.*\s+in\b/.test(code)) {
      return 'lua';
    }
  }

  if (/\blocal\s+\w+\s*=\s*table\./.test(code)) {
    return 'lua';
  }

  if (/\bfor\s+\w+,\s*\w+\s+in\s+(ipairs|pairs)\s*\(/.test(code)) {
    return 'lua';
  }

  // Lua keywords and patterns
  if (/\b(local|function|end|then|elseif|repeat|until)\b/.test(code)) {
    if (/\bfunction\s+\w+\s*\(.*\)|local\s+\w+\s*=/.test(code)) {
      // Exclude Solidity
      if (/\b(address|uint256|public|private|external|internal|returns)\b/.test(code)) {
        return null;
      }
      // Exclude TypeScript/JavaScript (has type annotations or semicolons)
      if (/:\s*(string|number|boolean|void|any|unknown|never|Promise<)/.test(code)) {
        return null;
      }
      // Exclude JavaScript (has curly braces without 'end')
      if (/\bfunction\s+\w+\s*\([^)]*\)\s*\{/.test(code) && !/\bend\b/.test(code)) {
        return null;
      }
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
