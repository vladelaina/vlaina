import type { LanguageDetector } from '../types';

export const detectYAML: LanguageDetector = (ctx) => {
  const { code, lines, first100Lines, firstLine } = ctx;

  if (/^#include\s*[<"]/m.test(first100Lines) || /\b(public|private|protected):\s*$/m.test(code) || /\b(virtual|override|noexcept|enum\s+class)\b/.test(code) || /\bstd::/.test(code)) {
    return null;
  }

  if (
    /\b(for\s+\w+\s+in|do|done|if\s+\[|then|fi)\b/.test(code) &&
    /^\s*echo\s+["'][^"']+:\s*["']?\s*$/m.test(code)
  ) {
    return null;
  }

  if (/^\s+at\s+\w+.*:\d+:\d+\)?$/m.test(code)) {
    return null;
  }

  // Simple single-line YAML patterns
  if (lines.length <= 3) {
    if (/^[\w-]+:\s+\w+/.test(code.trim())) {
      if (!/\{|\}|;|function|class|def|import|package/.test(code)) {
        return 'yaml';
      }
    }
  }

  // Kubernetes YAML (must be before Makefile check)
  if (/\b(apiVersion|kind|metadata|spec|services|volumes|networks):\s*/.test(first100Lines)) {
    return 'yaml';
  }

  // Docker Compose YAML (very strong indicator)
  if (/^version:\s*['"]?\d+(\.\d+)?['"]?\s*$/m.test(first100Lines)) {
    if (/\b(services|volumes|networks):\s*$/m.test(code)) {
      return 'yaml';
    }
  }

  // Docker Compose services structure (very strong indicator)
  if (/^services:\s*$/m.test(code) && /^\s{2,}\w+:\s*$/m.test(code)) {
    if (/\b(image|build|ports|environment|depends_on|volumes):\s*/.test(code)) {
      return 'yaml';
    }
  }

  // Docker Compose depends_on (strong indicator)
  if (/\bdepends_on:\s*$/m.test(code)) {
    return 'yaml';
  }

  // Docker Compose environment variables (list format)
  if (/\benvironment:\s*$/m.test(code) && /^\s+-\s+\w+=/m.test(code)) {
    return 'yaml';
  }

  // Docker Compose volumes mapping
  if (/\bvolumes:\s*$/m.test(code) && /^\s+-\s+[./]/.test(code)) {
    return 'yaml';
  }

  // Docker Compose image specification
  if (/\bimage:\s*\w+:\d+/.test(code) && /\bservices:\s*$/m.test(code)) {
    return 'yaml';
  }

  // YAML with nested structure (indentation)
  if (/^[\w-]+:\s*$/m.test(code) && /^\s{2,}[\w-]+:\s*/m.test(code)) {
    // Check if it's not Makefile (Makefile uses tabs)
    if (!/^\t/m.test(code) && !/\$\(/.test(code)) {
      return 'yaml';
    }
  }

  if (/^\s*-\s+[\w-]+:\s*/m.test(code) && /^\s{2,}[\w-]+:\s*/m.test(code)) {
    return 'yaml';
  }

  // YAML document separator
  if (/^---\s*$/m.test(code)) {

    if (/\b(import|export)\s+/.test(code) || /<\w+/.test(code)) {
      return null;
    }

    if (/^[\w-]+:\s+/m.test(code) || /^\s{2,}[\w-]+:/m.test(code)) {
      return 'yaml';
    }
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
        if (
          listCount >= 2 &&
          !/\{|\}|;/.test(code) &&
          (
            /^[\w-]+:\s*/m.test(code) ||
            /^\s*-\s+[\w-]+:\s*/m.test(code) ||
            /^---\s*$/m.test(code)
          )
        ) {
          return 'yaml';
        }
      }
    }
  }

  return null;
};
