import type { LanguageDetector } from '../types';

export const detectStylus: LanguageDetector = (ctx) => {
  const { code, first100Lines, lines } = ctx;

  // Simple Stylus patterns - indented CSS without braces/semicolons
  if (lines.length <= 5 && !/[{}]/.test(code) && !/;/.test(code)) {
    if (/^[\w-]+\s*$/m.test(code) && /^\s{2,}[\w-]+\s+/.test(code)) {
      return 'stylus';
    }
  }

  // Stylus variable assignment (no $ or @)
  if (/^[\w-]+\s*=\s*[^=]/m.test(code)) {
    // Check if it's CSS-related
    if (/\b(color|background|margin|padding|border|width|height|display|position|font)\b/.test(first100Lines) &&
        !/[@$][\w-]+/.test(first100Lines) && !/\bdef\s+\w+\s*\(/.test(first100Lines)) {
      return 'stylus';
    }
  }

  if (/\b(val|def|var)\s+\w+/.test(first100Lines)) {
    if (/\b(trans|Picture|draw|forward|right|repeat|import\s+scala)\b/.test(code)) {
      return null;
    }
  }

  if (/\b(import\s+(Foundation|UIKit|SwiftUI)|func\s+\w+\s*\(|var\s+\w+:\s*\w+|let\s+\w+:\s*\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(function\s+\w+\s*\(|end\b|using\s+\w+|module\s+\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(module\s+\w+\s+where|import\s+qualified|data\s+\w+\s*=)\b/.test(first100Lines)) {
    return null;
  }

  if (/^#!.*\b(runhaskell|runghc|ghc)\b/.test(ctx.firstLine)) {
    return null;
  }
  if (/::\s*[A-Z][\w\s]*/.test(first100Lines)) {
    return null;
  }
  if (/^import\s+[A-Z][\w.]*/m.test(first100Lines)) {
    return null;
  }

  if (/\b(def\s+\w+\s*\(.*\)\s*:|class\s+\w+\s*:)\b/.test(first100Lines)) {
    return null;
  }

  if (/\bfrom\s+\w+\s+import\b/.test(first100Lines) || /\bimport\s+\w+/.test(first100Lines)) {

    if (/\b(def\s+\w+|class\s+\w+|if\s+__name__|print\(|range\(|TypeVar|Optional|Union|Any|Callable)\b/.test(first100Lines)) {
      return null;
    }
  }

  if (/^[\w-]+\(\)\s*$/m.test(code)) {

    if (/\b(color|background|margin|padding|border|width|height|display|position|font)\b/.test(first100Lines)) {
      return 'stylus';
    }
  }

  if (/^[\w-]+\s*=\s*[^=]/m.test(code)) {

    if (/\bdef\s+\w+\s*\(/.test(first100Lines)) {
      return null;
    }

    if (/\b(color|background|margin|padding|border|width|height|display|position|font)\b/.test(first100Lines) &&
        !/[@$][\w-]+/.test(first100Lines)) {
      return 'stylus';
    }
  }

  if (/@extends\s+/.test(code)) {
    return 'stylus';
  }

  if (!/[{}]/.test(code) && !/;/.test(code)) {

    if (/\bdef\s+\w+\s*\(/.test(first100Lines)) {
      return null;
    }

    if (/^[\w-]+\s*=\s*[^=]/m.test(code)) {

      if (/\b(color|background|margin|padding|border|width|height|display|position|font-size)\b/.test(first100Lines)) {
        return 'stylus';
      }
    }
  }

  if (/\{/.test(code)) {

    if (/^[\w-]+\s*=\s*[^=]/m.test(code) && !/[@$][\w-]+/.test(first100Lines)) {
      if (/\b(color|background|margin|padding|border)\b/.test(first100Lines)) {
        return 'stylus';
      }
    }
  }

  return null;
};
