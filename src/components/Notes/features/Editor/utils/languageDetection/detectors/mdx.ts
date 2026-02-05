import type { LanguageDetector } from '../types';

export const detectMDX: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

  // Single-line import in MDX context
  if (ctx.lines.length <= 3) {
    const trimmed = code.trim();
    // MDX import: import { Button } from './components'
    if (/^import\s+\{[^}]+\}\s+from\s+['"][^'"]*['"]$/.test(trimmed)) {
      // Could be JavaScript or MDX, return null to let context decide
      // In MDX files, imports are common at the top
      return null; // Let JavaScript handle it for now
    }
  }

  if (/^\\(name|alias|title|usage|arguments|value|description|details|docType)\{/m.test(first100Lines)) {
    return null;
  }

  if (/^package\s+[\w:]+;/m.test(first100Lines) ||
      /^use\s+(strict|warnings|lib)\b/m.test(first100Lines)) {
    return null;
  }

  if (/^"\s/m.test(first100Lines) &&
      (/\b(function!|endfunction|call\s+\w+)\b/.test(first100Lines) ||
       /UseVimball/.test(first100Lines))) {
    return null;
  }

  if (/^require\s+['"]/.test(first100Lines) ||
      (/^class\s+\w+/m.test(first100Lines) && /\b(attr_reader|attr_accessor|def\s+\w+|include\s+\w+)\b/.test(first100Lines))) {
    return null;
  }

  if (/^---\s*$/.test(firstLine)) {

    if (/^import\s+.*from\s+['"]/.test(first100Lines)) {

      if (/^#{1,6}\s+/m.test(code) || /\[.*\]\(.*\)/.test(code)) {
        return 'mdx';
      }
    }

    if (/^export\s+(const|function|default)/.test(first100Lines)) {

      if (/^#{1,6}\s+/m.test(code)) {
        return 'mdx';
      }
    }
  }

  if (/^#{1,6}\s+/m.test(code)) {

    if (/<[A-Z]\w+/.test(code)) {

      if (/^(import|export)\s+/.test(first100Lines)) {
        return 'mdx';
      }
    }
  }

  if (/^import\s+\{[^}]+\}\s+from\s+['"]/.test(first100Lines)) {
    if (/<[A-Z]\w+/.test(code)) {
      return 'mdx';
    }
  }

  if (/^#{1,6}\s+/m.test(code) && /\{[\s\S]*?\}/.test(code)) {

    if (/\{[^}]*(Math\.|props\.|const\s+|function\s+|=>)/.test(code)) {
      return 'mdx';
    }
  }

  return null;
};
