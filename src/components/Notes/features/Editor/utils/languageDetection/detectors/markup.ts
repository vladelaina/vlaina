import type { LanguageDetector } from '../types';

export const detectHTML: LanguageDetector = (ctx) => {
  const { first100Lines, sample, code, firstLine, lines } = ctx;

  if (lines.length <= 3) {
    if (/\{\{[\s\S]*?\}\}/.test(code)) {
      return null;
    }
    if (/<(div|span|p|a|img|h[1-6]|ul|ol|li|table|form|input|button)[^>]*>/.test(code)) {
      return 'html';
    }
  }

  if (/\$\w+\s*=~\s*s\//.test(code)) {
    return null;
  }

  if (/=~\s*s\/.*<[a-z]+/.test(code)) {
    return null;
  }

  if (/^using\s+System/m.test(first100Lines) ||
      /^package\s+\w+/m.test(first100Lines) ||
      sample.includes('<?php')) {
    return null;
  }

  if (firstLine.includes('<?xml') && !/xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/.test(first100Lines)) {
    return null;
  }

  if (/xmlns[:=]/.test(first100Lines) && !/xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/.test(first100Lines)) {
    return null;
  }

  if (/\b(CREATE\s+TABLE|INSERT\s+INTO|SELECT\s+.*\s+FROM|DROP\s+TABLE|SHOW\s+WARNINGS)\b/i.test(first100Lines)) {
    return null;
  }

  if (firstLine.trim() === '---' && /^---\n[\s\S]*?\n---/.test(code)) {
    return null;
  }

  if (/\{%[\s\S]*?%\}/.test(code) && /\{%\s*(if|for|block|extends|include|macro|set|assign|capture|case)\b/.test(code)) {
    return null;
  }

  if (/\{\{#(if|each|with|unless)/.test(code) || /\{\{>\s*\w+/.test(code)) {
    return null;
  }

  if (/Astro\.(props|slots|request|url)/.test(code)) {
    return null;
  }

  if (/<!DOCTYPE\s+html>/i.test(first100Lines) ||
      /<html[\s>]/i.test(first100Lines) ||
      /<html\s+xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/.test(first100Lines) ||
      /<head[\s>]/i.test(first100Lines) ||
      /<body[\s>]/i.test(first100Lines)) {
    return 'html';
  }

  if (/<script[\s>]/i.test(first100Lines)) {
    if (!/\{%|\{\{#|\{\{>|Astro\./.test(code)) {
      return 'html';
    }
  }

  if (/^<\/(html|head|body|div|ul|ol|table|form)>/im.test(first100Lines)) {
    return 'html';
  }

  const htmlTagMatches = first100Lines.match(/<(div|span|p|a|img|table|form|input|button|h[1-6]|ul|ol|li)[\s>\/]/gi);
  if (htmlTagMatches && htmlTagMatches.length >= 2) {
    if (!/\{%|\{\{#|\{\{>|Astro\./.test(code)) {
      return 'html';
    }
  }

  if (/<(a|img|div|span|input|button|link|meta|script)[^>]*(href|src|class|id|style|alt|width|height)=/i.test(first100Lines)) {
    if (!/\{%|\{\{#|\{\{>|Astro\./.test(code)) {
      return 'html';
    }
  }

  return null;
};

export const detectMarkdown: LanguageDetector = (ctx) => {
  const { first100Lines, lines, sample, firstLine, code } = ctx;

  if (/:=/.test(first100Lines) && /^\t/m.test(code)) {
    return null;
  }

  if (/^using\s+System/m.test(first100Lines) ||
      /^package\s+\w+;/m.test(first100Lines) ||
      sample.includes('<?php') ||
      /\b(function\s+\w+\s*\(|def\s+\w+|impl\s+\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/^extends\s+\w+/m.test(first100Lines)) {
    return null;
  }

  if (/\b(proc\s+\w+|import\s+\w+|when\s+defined\(|task\s+\w+,|switch\(|const\s*$|let\s*$)\b/m.test(first100Lines)) {
    return null;
  }

  if (/<-/.test(first100Lines) && /\b(library|function|data\.frame)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(require\s+["']|class\s+\w+|def\s+\w+)\b/.test(first100Lines) && /\bend\b/.test(code)) {
    return null;
  }

  if (/^use\s+(strict|warnings|v\d+)/m.test(first100Lines) || /^package\s+[\w:]+;/m.test(first100Lines)) {
    return null;
  }

  if (/\b(apiVersion|kind|metadata|spec|data|rules|subjects):\s*/.test(first100Lines)) {
    return null;
  }

  if (/^#/.test(firstLine) && /^[\w-]+:\s*/m.test(first100Lines)) {
    const kvCount = (first100Lines.match(/^[\w-]+:\s*/gm) || []).length;
    if (kvCount >= 3) {
      return null;
    }
  }

  if (/^---\s*$/.test(firstLine)) {
    if (/\b(apiVersion|kind|metadata|spec|data|rules|subjects):\s*/.test(first100Lines)) {
      return null;
    }

    if (/^#{1,6}\s+/m.test(first100Lines) || /\[.*\]\(.*\)/.test(first100Lines) || /^[-*+]\s+/m.test(first100Lines)) {
      return 'markdown';
    }
  }

  const headingCount = lines.slice(0, 20).filter((line) => /^#{1,6}\s+/.test(line)).length;
  const bulletCount = lines.slice(0, 20).filter((line) => /^[-*+]\s+/.test(line)).length;
  const hasCodeBlock = /```\w*\n/.test(code);
  const hasTable = /\|.*\|.*\|/.test(first100Lines);
  const hasTableDivider = /^\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/m.test(first100Lines);
  const hasLinks = /\[.*\]\(.*\)/.test(first100Lines);

  if (headingCount >= 2 && hasCodeBlock) {
    return 'markdown';
  }

  if (hasTable && (headingCount > 0 || hasCodeBlock || hasTableDivider)) {
    return 'markdown';
  }

  if (headingCount >= 3) {
    return 'markdown';
  }

  if (bulletCount >= 2 && !/^[\w-]+:\s*/m.test(first100Lines)) {
    return 'markdown';
  }

  if (headingCount >= 1 && hasLinks && /^##\s+/.test(code)) {
    return 'markdown';
  }

  const mdScore = (
    (headingCount > 0 ? 2 : 0) +
    (/^[-*+]\s+/.test(first100Lines) ? 1 : 0) +
    (hasLinks ? 1 : 0) +
    (/^>\s+/.test(first100Lines) ? 1 : 0) +
    (hasCodeBlock ? 2 : 0) +
    (/^[=\-]{3,}$/m.test(first100Lines) ? 1 : 0) +
    (/^\*\*.*\*\*|^_.*_|^\*.*\*/.test(first100Lines) ? 1 : 0) +
    (hasTable ? 1 : 0)
  );

  if (mdScore >= 2) {
    return 'markdown';
  }

  if (lines.length <= 3) {
    if (/!\[.*\]\(.*\)/.test(sample)) {
      return 'markdown';
    }
    if (
      /\*\*|`|(^|\s)\*[^*\n]+\*(\s|$)|(^|\s)_[^_\n]+_(\s|$)/.test(sample) ||
      /^[a-z]+\.(md|markdown)$/i.test(sample.trim())
    ) {
      return 'markdown';
    }
  }

  return null;
};
