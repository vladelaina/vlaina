import type { LanguageDetector } from '../types';

export const detectCoffeeScript: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/^\s*fn\s+\w+\s*\([^)]*\)\s*->/.test(first100Lines) || /\bOption<[A-Z]\w*>/.test(first100Lines)) {
    return null;
  }

  if (/:=/.test(first100Lines) && /^\t/m.test(code)) {
    return null;
  }

  if (/<!--\s*livebook:/.test(first100Lines) && /^#\s+/m.test(first100Lines)) {
    return null;
  }

  if (/\bdef\s+\w+/.test(first100Lines)) {
    if (/\b(Picture|trans|rot|scale|GPics|drawing|stem)\b/.test(code) ||
        /\bdef\s+\w+\s*\(.*\)\s*:\s*\w+/.test(first100Lines) ||
        /\bval\s+\w+\s*=/.test(first100Lines)) {
      return null;
    }
  }

  if (/\b(import|export)\s+.*\s+from\s+['"]/.test(first100Lines) ||
      /:\s*(string|number|boolean|any|void|Promise|Array)\b/.test(first100Lines)) {
    return null;
  }

  if (/^\(ns\s+[\w.-]+|^\((def|defn|defmacro|deftask)\s+/m.test(first100Lines)) {
    return null;
  }
  if (/^;;/.test(first100Lines) && /^\(/m.test(first100Lines)) {
    return null;
  }

  if (!/[{}]/.test(code) && /^(html|head|body|div|span|p|a|img|script|style|link|meta|h[1-6])\b/m.test(code)) {
    return null;
  }

  if (/^[\w-]+:\s*$/m.test(code) && /^\t/.test(code)) {
    return null;
  }

  if (/<-/.test(first100Lines) && /\b(library|function)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(const|let|var)\s+\w+\s*=/.test(first100Lines) && /;/.test(first100Lines)) {
    return null;
  }

  if (/@import\(["']/.test(first100Lines)) {
    return null;
  }

  if (/^package\s+[\w:]+;/m.test(first100Lines) ||
      /^use\s+(strict|warnings|sigtrap|lib|Carp|File::)\b/m.test(first100Lines)) {
    return null;
  }

  if (/^task\s+['"]/.test(code) && /->/.test(code)) {
    return 'coffeescript';
  }

  if (/\brequire\s+['"]/.test(first100Lines)) {

    if (/->|=>/.test(code)) {
      return 'coffeescript';
    }
  }

  // CoffeeScript arrow functions (very distinctive)
  if (/->|=>/.test(code)) {
    // Check for CoffeeScript-specific patterns
    if (/\w+\s*=\s*\([^)]*\)\s*->/.test(code) ||
        /\w+\s*=\s*->/.test(code) ||
        /\([^)]*\)\s*->/.test(code) ||
        /\w+:\s*\([^)]*\)\s*->/.test(code)) {
      return 'coffeescript';
    }
    
    // CoffeeScript assignment with arrow
    if (/^\w+\s*=\s*\([^)]*\)\s*->/m.test(code)) {
      return 'coffeescript';
    }
  }

  // CoffeeScript comprehension
  if (/\w+\s*=\s*\([^)]*for\s+\w+\s+in\s+/.test(code)) {
    return 'coffeescript';
  }

  if (/for\s+\w+\s+in\s+/.test(code) && /->/.test(code)) {
    return 'coffeescript';
  }

  if (/@\w+/.test(code) && /->|=>/.test(code)) {
    return 'coffeescript';
  }

  if (/\{[\w,\s]+\}\s*=/.test(code) && /->|=>/.test(code)) {
    return 'coffeescript';
  }

  return null;
};
