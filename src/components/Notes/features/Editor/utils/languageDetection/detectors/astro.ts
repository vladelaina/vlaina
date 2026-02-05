import type { LanguageDetector } from '../types';

export const detectAstro: LanguageDetector = (ctx) => {
  const { code, firstLine, first100Lines } = ctx;

  if (/^---/.test(firstLine)) {
    const frontmatterMatch = code.match(/^---\r?\n?([\s\S]*?)\r?\n?---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];

      if (/import.*from\s+['"]astro|Astro\.(props|slots|request)/.test(frontmatter)) {
        return 'astro';
      }

      if (/import.*from\s+['"][^'"]*\.astro['"]/.test(frontmatter)) {
        return 'astro';
      }

      if (/import\s+\w+\s+from\s+['"][^'"]*\/components\//.test(frontmatter)) {
        if (/<html|<head|<body|<main/.test(code)) {
          return 'astro';
        }
      }

      if (/\/\*\s*ASTRO:/.test(frontmatter)) {
        return 'astro';
      }

      if (/\b(let|const|var)\s+\w+\s*=/.test(frontmatter)) {
        const afterFrontmatter = code.substring(frontmatterMatch[0].length);
        if (/<[a-zA-Z][a-zA-Z0-9]*[\s>\/]/.test(afterFrontmatter)) {
          return 'astro';
        }
      }
    }
  }

  if (/^---[\s\S]*?---/.test(first100Lines) && /Astro\.(props|slots|request|url|redirect)/.test(code)) {
    return 'astro';
  }

  return null;
};
