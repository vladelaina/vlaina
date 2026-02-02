import type { LanguageDetector } from '../types';

export const detectLaTeX: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/:=/.test(first100Lines) && /^\t/m.test(code)) {
    return null;
  }

  if (/^#{1,6}\s+/m.test(first100Lines)) {

    if (/^##\s+(SYNOPSIS|DESCRIPTION|OPTIONS|EXAMPLES|SEE ALSO|AUTHOR)/m.test(first100Lines) ||
        /^#\s+\w+.*--/.test(first100Lines)) {
      return null;
    }
  }

  if (/\\documentclass/.test(code)) {
    return 'latex';
  }

  if (/\\(begin|end|usepackage|section|subsection|chapter|title|author|date|maketitle|textbf|textit|item|label|ref|cite)\{/.test(code)) {
    return 'latex';
  }

  if (/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/.test(code)) {
    return 'latex';
  }

  return null;
};
