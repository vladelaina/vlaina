import type { LanguageDetector } from '../types';

export const detectAstro: LanguageDetector = (ctx) => {
  const { code, firstLine, first100Lines } = ctx;

  if (firstLine.trim() === '---') {
    const frontmatterMatch = code.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];

      if (/import.*from\s+['"]astro|Astro\.(props|slots|request)/.test(frontmatter)) {
        return 'astro';
      }

      if (/import.*from\s+['"][^'"]*\.astro['"]/.test(frontmatter)) {
        return 'astro';
      }

      // Check for component imports from /components/ directory
      if (/import\s+\w+\s+from\s+['"][^'"]*\/components\//.test(frontmatter)) {
        // If has HTML tags, likely Astro
        if (/<html|<head|<body|<main/.test(code)) {
          return 'astro';
        }
      }

      if (/\/\*\s*ASTRO:/.test(frontmatter)) {
        return 'astro';
      }

      if (/\blet\s+\w+\s*=|const\s+\w+\s*=/.test(frontmatter)) {

        if (/<html|<head|<body|<main/.test(code)) {
          return 'astro';
        }
      }
    }
  }

  if (/^---\n[\s\S]*?\n---/.test(code) && /Astro\.(props|slots|request|url|redirect)/.test(code)) {
    return 'astro';
  }

  return null;
};
