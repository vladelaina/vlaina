import type { LanguageDetector } from '../types';

export const detectLaTeX: LanguageDetector = (ctx) => {
  const { code, first100Lines, lines } = ctx;

  // Simple single-line LaTeX patterns
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // LaTeX inline math: $E = mc^2$
    if (/^\$[^$]+\$$/.test(trimmed)) {
      // Check if it's LaTeX math (has LaTeX commands or math symbols)
      if (/\\[a-zA-Z]+|[=+\-*/^_{}]/.test(trimmed)) {
        return 'latex';
      }
    }
  }

  if (/:=/.test(first100Lines) && /^\t/m.test(code)) {
    return null;
  }

  if (/^#{1,6}\s+/m.test(first100Lines)) {

    if (/^##\s+(SYNOPSIS|DESCRIPTION|OPTIONS|EXAMPLES|SEE ALSO|AUTHOR)/m.test(first100Lines) ||
        /^#\s+\w+.*--/.test(first100Lines)) {
      return null;
    }
  }

  // LaTeX document class (must be before R check)
  if (/\\documentclass/.test(code)) {
    return 'latex';
  }

  // LaTeX commands
  if (/\\(begin|end|usepackage|section|subsection|chapter|title|author|date|maketitle|textbf|textit|item|label|ref|cite)\{/.test(code)) {
    // Check if it's really LaTeX (not R with backslashes)
    if (/\\documentclass|\\begin\{document\}|\\usepackage/.test(code)) {
      return 'latex';
    }
    return 'latex';
  }

  if (/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/.test(code)) {
    return 'latex';
  }

  return null;
};
