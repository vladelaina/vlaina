// KaTeX utility functions
import katex from 'katex';

export interface RenderResult {
  html: string;
  error: string | null;
}

/**
 * Render LaTeX to HTML using KaTeX
 */
export function renderLatex(latex: string, displayMode: boolean): RenderResult {
  if (!latex.trim()) {
    return {
      html: `<span class="math-placeholder">${displayMode ? 'Equation' : 'formula'}</span>`,
      error: null
    };
  }

  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      strict: false,
      trust: true,
      macros: {
        '\\R': '\\mathbb{R}',
        '\\N': '\\mathbb{N}',
        '\\Z': '\\mathbb{Z}',
        '\\Q': '\\mathbb{Q}',
        '\\C': '\\mathbb{C}'
      }
    });
    return { html, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return {
      html: `<span class="math-error">Error equation</span>`,
      error: errorMessage
    };
  }
}

/**
 * Check if LaTeX string is valid
 */
export function isValidLatex(latex: string): boolean {
  if (!latex.trim()) return true;
  
  try {
    katex.renderToString(latex, { throwOnError: true });
    return true;
  } catch {
    return false;
  }
}
