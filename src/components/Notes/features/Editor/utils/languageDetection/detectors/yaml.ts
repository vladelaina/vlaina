import type { LanguageDetector } from '../types';

export const detectYAML: LanguageDetector = (ctx) => {
  const { code, lines, first100Lines, firstLine } = ctx;

  if (/^---\s*$/m.test(code)) {

    if (/\b(import|export)\s+/.test(code) || /<\w+/.test(code)) {
      return null;
    }

    if (/^[\w-]+:\s+/m.test(code) || /^\s{2,}[\w-]+:/m.test(code)) {
      return 'yaml';
    }
  }

  if (/^\.\.\.\s*$/m.test(code) && /^[\w-]+:\s+/m.test(code)) {
    return 'yaml';
  }

  if (/\b(apiVersion|kind|metadata|spec|services|volumes|networks):\s*/.test(first100Lines)) {
    return 'yaml';
  }

  if (/^(hint|path|define|symbol|cs|gc|opt|warning)\[?\w*\]?:/m.test(first100Lines)) {
    return null;
  }

  if (/^[\w-]+:\s*$/m.test(code) && /^\t/m.test(code)) {
    return null;
  }

  if (/^#{1,6}\s+[^:]+$/m.test(first100Lines)) {

    if (!/:\s*/.test(first100Lines) || /\[.*\]\(.*\)/.test(first100Lines)) {
      return null;
    }
  }

  if (/\b(proc|iterator|template|macro)\s+\w+/.test(first100Lines) ||
      /^from\s+\w+\s+import\b/m.test(first100Lines)) {
    return null;
  }

  if (/\{[\s\S]*?\}/.test(code) && /[;:]/.test(code)) {

    if (/\.[\w-]+\s*\{|#[\w-]+\s*\{/.test(code)) return null;
    if (/function\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+/.test(code)) return null;
  }

  if (code.includes('---') && lines[0].trim() === '---') {

    if (/\b(apiVersion|kind|metadata|spec|data|rules|subjects|name|version|description):\s*/.test(first100Lines)) {
      return 'yaml';
    }
  }

  if (/^#/.test(firstLine) && /^[\w-]+:\s*/m.test(first100Lines)) {

    const kvCount = (first100Lines.match(/^[\w-]+:\s*/gm) || []).length;
    if (kvCount >= 3) {
      return 'yaml';
    }
  }

  const yamlKeyPattern = /^[a-zA-Z_][\w-]*:\s*(?:[^\n]|$)/m;
  if (yamlKeyPattern.test(code)) {

    let validCount = 0;
    const maxLines = Math.min(lines.length, 20);
    for (let i = 0; i < maxLines; i++) {
      const trimmed = lines[i].trim();
      // Skip comments and empty lines
      if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed === '') continue;
      // Skip lines with colons in strings
      if (trimmed.includes('://')) continue;
      if (/^[a-zA-Z_][\w-]*:\s*/.test(trimmed)) {
        validCount++;
        if (validCount >= 3) return 'yaml';
      }
    }
  }

  if (/^\s*-\s+\w+/m.test(code)) {

    let listCount = 0;
    const maxLines = Math.min(lines.length, 20);
    for (let i = 0; i < maxLines; i++) {
      if (/^\s*-\s+\w+/.test(lines[i])) {
        listCount++;
        if (listCount >= 2 && !/\{|\}|;/.test(code)) {
          return 'yaml';
        }
      }
    }
  }

  return null;
};
