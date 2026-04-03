import type { LanguageDetector } from '../types';

export const detectJulia: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine, lines } = ctx;

  if (!/^\s*#/.test(firstLine) && /;/.test(code) && /\b(plot|linspace|zeros|ones|eye|disp|size|meshgrid)\s*\(/.test(code)) {
    return null;
  }

  if (/^\w+\s*=\s*\[[\d\s.;]+\];?$/m.test(first100Lines)) {
    if (/\b(disp|plot|size|zeros|ones|eye|linspace|meshgrid|arrayfun)\s*\(/.test(code)) {
      return null;
    }
  }

  if (/\blocal\s+\w+\s*=/.test(first100Lines) || /\b(ipairs|pairs|table\.)/.test(code)) {
    return null;
  }

  // Simple single-line Julia patterns
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // Julia single-line function: f(x) = x^2 + 2x + 1
    if (/^[a-z_]\w*\s*\([^)]*\)\s*=\s*.+$/.test(trimmed)) {
      // Check if it's not other languages
      if (!/\{|\}|;|function|def|=>/.test(trimmed)) {
        return 'julia';
      }
    }
    if (/^println\s*\(/.test(trimmed) && /\^\d+/.test(code)) {
      return 'julia';
    }
  }

  if (/^use\s+(strict|warnings|lib)\b/m.test(first100Lines) ||
      /^package\s+[\w:]+;/m.test(first100Lines) ||
      /^=head\d+\s+/m.test(first100Lines)) {
    return null;
  }

  if (/^module\s+[A-Z]\w*$/m.test(first100Lines) &&
      /\bdef\s+\w+/.test(first100Lines) &&
      /\bend\b/.test(code)) {
    return null;
  }

  if (/^module\s+[A-Z]\w*$/m.test(first100Lines) &&
      /^\s+class\s+[A-Z]\w*$/m.test(code) &&
      /^\s*end\s*$/m.test(code)) {
    return null;
  }

  if (/\b(import|export|const|let|var|function|class)\s+/.test(first100Lines) && /[{}]/.test(first100Lines)) {
    return null;
  }

  if (/^\[[\w.-]+\]\s*$/m.test(code)) {
    return null;
  }

  // Julia vectorized operations: x .^ 2 .+ 2 .* x
  if (/\.\^|\.\+|\.\*|\.\//.test(code)) {
    // Check if it's Julia-style vectorized operations
    if (/\w+\s*=\s*\[[\d\s,]+\]/.test(code) || /\w+\s*\.\^\s*\d+/.test(code)) {
      return 'julia';
    }
  }

  // Julia array operations (must be before Makefile check)
  if (/\[[\d\s]+;[\d\s]+\]/.test(code) || /\.\^/.test(code)) {
    return 'julia';
  }

  // Julia array with semicolon separator
  if (/\w+\s*=\s*\[[\d\s]+;[\d\s]+\]/.test(code)) {
    return 'julia';
  }

  // Julia array with space-separated elements
  if (/\w+\s*=\s*\[[\d\s]+\]/.test(code) && /\.\^/.test(code)) {
    return 'julia';
  }

  // Julia struct definition: struct Point{T<:Real}
  if (/^struct\s+[A-Z]\w*\{[^}]+\}/m.test(code)) {
    return 'julia';
  }

  if (/^struct\s+[A-Z]\w*\s*$/m.test(first100Lines) && /::[A-Z]\w*/.test(code) && /^end\s*$/m.test(code)) {
    return 'julia';
  }

  if (/^function\s+\w+\s*\(/m.test(first100Lines) && /^end\s*$/m.test(code)) {
    if (/\b(sum|length|zeros|ones|rand|randn|println)\s*\(/.test(code) && !/\blocal\b|\bthen\b|\belseif\b|\bdo\b/.test(code)) {
      return 'julia';
    }
  }

  if (/^function\s+\w+\s*\(/m.test(code) && /^end\s*$/m.test(code)) {
    if (/\b(sum|length|zeros|ones|rand|randn|println)\s*\(/.test(code) && !/\blocal\b|\bthen\b|\belseif\b|\bdo\b/.test(code)) {
      return 'julia';
    }
  }

  if (/^[\w-]+\s*=\s*[^=]/m.test(code) && !/\bfunction\b|\bend\b/.test(first100Lines)) {
    if (/\[\s*\w+\s*\^\s*\d+\s+for\s+\w+\s+in\s+\d+:\d+/.test(code)) {
      return 'julia';
    }
    // Don't return null here - let other checks continue
  }

  if (/\bprintln\s*\(/.test(code) && /\d+\^\d+/.test(code)) {
    return 'julia';
  }

  if (/@time\s+/.test(code)) {
    return 'julia';
  }

  if (/\bwith\s+\w+\s*\(/.test(code) && /\bas\s+\w+:/.test(code)) {
    return null;
  }

  if (/\blambda\s+\w+/.test(code)) {
    return null;
  }

  if (/\w+\s*=\s*\[\s*\w+\s*\^\s*\d+\s+for\s+\w+\s+in\s+\d+:\d+/.test(code)) {
    return 'julia';
  }

  if (/\[.+\s+for\s+\w+\s+in\s+.+\]/.test(code)) {
    if (!/\bdef\s+\w+/.test(first100Lines)) {
      if (/\d+:\d+/.test(code) || /@time\b/.test(code) || /\bprintln\b/.test(code)) {
        return 'julia';
      }
    }
  }

  if (/\[\s*\w+\s*\^\s*\d+\s+for\s+\w+\s+in\s+\d+:\d+/.test(code)) {
    return 'julia';
  }

  if (/\[\s*\w+\s*\*\*\s*\d+\s+for\s+\w+\s+in\s+range\(/.test(code)) {
    return null;
  }

  if (/\bfor\s+\w+\s+in\s+\d+:\d+/.test(code)) {
    return 'julia';
  }

  if (/^function\s+\w+\s*\(/m.test(first100Lines) && /\bend\b/.test(code)) {

    if (/^##/.test(first100Lines) ||
        /\b(zeros|ones|rand|randn|println|using|module)\b/.test(first100Lines) ||
        /\[[\d\s.]+\]/.test(first100Lines)) {
      return 'julia';
    }
  }

  if (/^function\s+\w+\s*\(/m.test(first100Lines) && /\bend\b/.test(code)) {
    if (/^##/.test(first100Lines) ||
        /\b(zeros|ones|rand|randn|println|using|module)\b/.test(first100Lines) ||
        /\[[\d\s.]+\]/.test(first100Lines) ||
        /\bif\s+\w+\s*<=/.test(code) ||
        /\breturn\s+\w+\([^)]*\)\s*\+/.test(code)) {
      return 'julia';
    }
  }

  // Julia array operations (must be before Makefile check)
  if (/\[[\d\s]+;[\d\s]+\]/.test(code) || /\.\^/.test(code)) {
    return 'julia';
  }

  // Julia array with semicolon separator
  if (/\w+\s*=\s*\[[\d\s]+;[\d\s]+\]/.test(code)) {
    return 'julia';
  }

  // Julia array with space-separated elements
  if (/\w+\s*=\s*\[[\d\s]+\]/.test(code) && /\.\^/.test(code)) {
    return 'julia';
  }

  if (/\b(using|import)\s+[A-Z]\w*/.test(first100Lines)) {
    if (/\b(function|struct|mutable\s+struct|export|const)\b/.test(code)) {
      return 'julia';
    }
  }

  if (/^module\s+[A-Z]\w*$/m.test(first100Lines) &&
      /\b(function|struct|mutable\s+struct|export|const)\b/.test(code)) {
    return 'julia';
  }

  if (/@\w+/.test(code) && /\bfunction\b.*\bend\b/.test(code)) {

    if (!/\b(defmodule|def|defp)\b/.test(first100Lines)) {
      return 'julia';
    }
  }

  if (/::[A-Z]\w*/.test(code) && /\bfunction\b|\bend\b/.test(code)) {
    return 'julia';
  }

  if (/\w+\[[\d:,\s]+\]\s*=/.test(code) && /\bfunction\b|\bend\b/.test(code)) {
    return 'julia';
  }

  return null;
};
