import type { LanguageDetector } from '../types';

export const detectHTML: LanguageDetector = (ctx) => {
  const { first100Lines, sample } = ctx;
  
  // Exclude if it's clearly another language
  if (/^using\s+System/m.test(first100Lines) ||
      /^package\s+\w+/m.test(first100Lines) ||
      sample.includes('<?php')) {
    return null;
  }
  
  // Exclude SQL files (may have HTML in string literals)
  if (/\b(CREATE\s+TABLE|INSERT\s+INTO|SELECT\s+.*\s+FROM|DROP\s+TABLE|SHOW\s+WARNINGS)\b/i.test(first100Lines)) {
    return null;
  }
  
  // HTML doctype or common tags
  if (/<!DOCTYPE\s+html>/i.test(first100Lines) ||
      /<html[\s>]/i.test(first100Lines) ||
      /<head[\s>]/i.test(first100Lines) ||
      /<body[\s>]/i.test(first100Lines)) {
    return 'html';
  }
  
  // HTML script tag (including special types like Hoplon)
  if (/<script[\s>]/i.test(first100Lines)) {
    return 'html';
  }
  
  // HTML closing tags (for fragments)
  if (/^<\/(html|head|body|div|ul|ol|table|form)>/im.test(first100Lines)) {
    return 'html';
  }
  
  // HTML tags - but need multiple to be confident
  const htmlTagMatches = first100Lines.match(/<(div|span|p|a|img|table|form|input|button|h[1-6]|ul|ol|li)[\s>\/]/gi);
  if (htmlTagMatches && htmlTagMatches.length >= 2) {
    return 'html';
  }
  
  // Single HTML tag with attributes (likely HTML) - more flexible matching
  if (/<(a|img|div|span|input|button|link|meta|script)[^>]*(href|src|class|id|style|alt|width|height)=/i.test(first100Lines)) {
    return 'html';
  }
  
  return null;
};

export const detectMarkdown: LanguageDetector = (ctx) => {
  const { first100Lines, lines, sample, firstLine } = ctx;
  
  // Exclude if it's clearly code with strong indicators
  if (/^using\s+System/m.test(first100Lines) ||
      /^package\s+\w+;/m.test(first100Lines) ||
      sample.includes('<?php') ||
      /\b(function\s+\w+\s*\(|def\s+\w+|impl\s+\w+)\b/.test(first100Lines)) {
    return null;
  }
  
  // YAML frontmatter + Markdown content (like .workbook files)
  if (/^---\s*$/.test(firstLine)) {
    if (/^#{1,6}\s+/m.test(first100Lines) || /\[.*\]\(.*\)/.test(first100Lines) || /^[-*+]\s+/m.test(first100Lines)) {
      return 'markdown';
    }
  }
  
  // Markdown patterns
  const mdScore = (
    (lines.slice(0, 20).filter(l => /^#{1,6}\s+/.test(l)).length > 0 ? 2 : 0) +
    (/^[-*+]\s+/.test(first100Lines) ? 1 : 0) +
    (/\[.*\]\(.*\)/.test(first100Lines) ? 1 : 0) +
    (/^>\s+/.test(first100Lines) ? 1 : 0) +
    (/```/.test(first100Lines) ? 1 : 0) +
    (/^[=\-]{3,}$/m.test(first100Lines) ? 1 : 0) +  // Setext headers
    (/^\*\*.*\*\*|^_.*_|^\*.*\*/.test(first100Lines) ? 1 : 0)  // Bold/italic
  );
  
  if (mdScore >= 2) {
    return 'markdown';
  }
  
  // Very simple markdown - just text with basic formatting or just a filename
  if (lines.length <= 3) {
    if (/\*\*|\*|_|`/.test(sample) || /^[A-Z]/.test(sample) || /^[a-z]+\.(md|markdown)$/i.test(sample.trim())) {
      return 'markdown';
    }
  }
  
  return null;
};
