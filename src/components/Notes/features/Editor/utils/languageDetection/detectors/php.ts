import type { LanguageDetector } from '../types';

export const detectPHP: LanguageDetector = (ctx) => {
  const { firstLine, sample, first100Lines, hasConst, hasLet, lines, code } = ctx;

  if (/\btry\s+std\.(io|heap|mem)\./.test(first100Lines)) {
    return null;
  }

  if (/std\.io\.getStdOut\(\)/.test(first100Lines)) {
    return null;
  }

  // Exclude Dart
  if (/\bvoid\s+main\s*\(\s*\)\s*\{/.test(first100Lines)) {
    if (/\bprint\s*\(['"]/.test(first100Lines) && !/\$\w+/.test(first100Lines)) {
      return null;
    }
  }

  // PHP opening tag
  if (firstLine.startsWith('<?php') || sample.includes('<?php') || sample.includes('<?=')) {
    return 'php';
  }

  if (/\b(server|location|listen|root|index|proxy_pass)\s+/.test(first100Lines)) {
    return null;
  }

  if (/\b(Get|Set|New|Remove|Add|Clear|Write|Read|Test|Start|Stop|Invoke|Import|Export)-[A-Z]\w+/.test(first100Lines)) {
    return null;
  }

  if (/^use\s+(strict|warnings|v\d+|feature)/.test(first100Lines) || /^package\s+\w+;/.test(first100Lines)) {
    return null;
  }

  if (/<-/.test(first100Lines) && /\b(library|function|data\.frame|c\()\b/.test(first100Lines)) {
    return null;
  }

  if (/\$[\w]+\s*=/.test(first100Lines)) {
    if (/\b(echo|print|function|class|namespace|use|require|include|foreach|elseif)\b/.test(first100Lines)) {
      if (!hasConst && !hasLet && !/\b(import|export|const|let|var)\b/.test(first100Lines)) {
        if (/\$\w+->\w+|\$\w+\[['"]/.test(first100Lines) ||
            /\bfunction\s+\w+\s*\([^)]*\$/.test(first100Lines)) {
          return 'php';
        }
      }
    }
  }

  if (/\$\w+\s*=\s*array_\w+\(/.test(code)) {
    return 'php';
  }

  if (/\bfn\s*\(\s*\$\w+\s*\)\s*=>/.test(code)) {
    return 'php';
  }

  if (/\$\w+->(query|prepare|execute)\(/.test(code)) {
    return 'php';
  }

  if (/\$\w+\s*=\s*array_/.test(first100Lines)) {
    return 'php';
  }

  if (/\bfn\s*\(\s*\$\w+\s*\)\s*=>/.test(first100Lines)) {
    return 'php';
  }

  if (/\$\w+->(query|prepare|execute)\s*\(/.test(first100Lines)) {
    return 'php';
  }

  // Simple single-line PHP patterns
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // PHP namespace: namespace App\Controllers;
    if (/^namespace\s+[A-Z]\w*(\\[A-Z]\w*)*;?$/.test(trimmed)) {
      return 'php';
    }
    if (/^echo\s+["']/.test(trimmed)) {
      // Check if it's shell (no semicolon) or PHP (with semicolon or <?php)
      if (/;/.test(code) || /\$\w+/.test(code)) {
        return 'php';
      }
      return null; // Let shell detector handle it
    }
    if (/\b(print|echo)\s*\(/.test(code) && /;/.test(code)) {
      if (!/\b(console\.|document\.|window\.|import|export|const|let|var|def|class|module|require|puts|System\.out)\b/.test(code)) {
        return 'php';
      }
    }
  }

  // PHP trait definition (must distinguish from Rust)
  if (/^trait\s+[A-Z]\w*\s*\{/m.test(code)) {
    // Check for PHP-specific syntax (public/private function with $)
    if (/\b(public|private|protected)\s+function/.test(code) || /\$\w+/.test(code)) {
      return 'php';
    }
    // If it has fn (Rust) instead of function (PHP), it's not PHP
    if (/\bfn\s+\w+\s*\(/.test(code) && !/\bfunction\s+\w+\s*\(/.test(code)) {
      return null;
    }
    return 'php';
  }

  return null;
};
