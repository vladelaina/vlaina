import type { LanguageDetector } from '../types';

export const detectJavaScript: LanguageDetector = (ctx) => {
  const { sample, first100Lines, firstLine, hasCurlyBraces, hasSemicolon, hasImport, hasConst, hasLet, hasFunction } = ctx;
  
  // Exclude if it's clearly another language
  if (sample.includes('<?php') || 
      sample.includes('#include <') ||
      /^package\s+\w+;/m.test(first100Lines) ||
      /\b(public\s+class|private\s+class|protected\s+class)\b/.test(first100Lines) ||
      /\b(fn\s+main|let\s+mut|impl\s+|pub\s+fn)\b/.test(first100Lines)) {
    return null;
  }
  
  // Exclude Markdown files with YAML frontmatter
  if (/^---\s*$/.test(firstLine) && /^#{1,6}\s+/m.test(first100Lines)) {
    return null;
  }
  
  // Strong TypeScript indicators - must check before JSX
  // Remove ALL comments more aggressively (handle multi-line comments that span many lines)
  let codeWithoutComments = first100Lines;
  // Remove multi-line comments (may span multiple lines)
  while (/\/\*[\s\S]*?\*\//.test(codeWithoutComments)) {
    codeWithoutComments = codeWithoutComments.replace(/\/\*[\s\S]*?\*\//g, ' ');
  }
  // Remove single-line comments
  codeWithoutComments = codeWithoutComments.replace(/\/\/.*/g, '');
  
  // TypeScript type annotations (but not in object literals)
  // Check for parameter types: constructor(public name: string) or function(param: type)
  if (/\bconstructor\s*\(\s*(public|private|protected)\s+\w+\s*\)/.test(codeWithoutComments)) {
    return 'typescript';
  }
  
  // Function parameter type annotations: function name(param: type) or (param: type) =>
  if (/\bfunction\s+\w+\s*\([^)]*:\s*(string|number|boolean|any|void|Promise|Array)/.test(codeWithoutComments)) {
    return 'typescript';
  }
  
  // Arrow function or regular function with parameter types
  if (/\(\s*\w+:\s*(string|number|boolean|any|void|Promise|Array)[^)]*\)\s*(:|=>)/.test(codeWithoutComments)) {
    return 'typescript';
  }
  
  // Strong TypeScript indicators (need at least 2 matches to be confident)
  const tsIndicators = [
    /\binterface\s+\w+\s*\{/.test(codeWithoutComments),
    /\btype\s+\w+\s*=/.test(codeWithoutComments),
    /\babstract\s+class\b/.test(codeWithoutComments),
    /\bimplements\s+\w+/.test(codeWithoutComments),
    /\b(public|private|protected)\s+(readonly\s+)?\w+:\s*\w+/.test(codeWithoutComments),
    /<T>|<T,/.test(codeWithoutComments),
    /:\s*(Promise<|Array<)/.test(codeWithoutComments)
  ].filter(Boolean).length;
  
  if (tsIndicators >= 2) {
    return 'typescript';
  }
  
  // Check for JSX/TSX
  if (/<[A-Z]\w+/.test(first100Lines) || /return\s*\(?\s*<[a-z]+/.test(first100Lines)) {
    if (tsIndicators >= 1 || sample.includes('interface ')) {
      return 'tsx';
    }
    return 'jsx';
  }
  
  // Simple browser/Node.js API calls
  if (/\b(console\.(log|error|warn|info)|alert|document\.|window\.|require\(|module\.exports)\b/.test(first100Lines)) {
    // Very simple files with just console.log might be TypeScript (TypeScript is a superset of JavaScript)
    if (ctx.lines.length <= 3 && /^console\.log\(/.test(first100Lines.trim())) {
      return 'typescript';
    }
    return 'javascript';
  }
  
  // Check for JavaScript - need at least some JS features
  if (!hasCurlyBraces && !hasSemicolon && !hasImport && !hasConst && !hasLet && !hasFunction) {
    return null;
  }
  
  const jsScore = (
    (hasImport && /^import\s+/.test(firstLine) ? 2 : 0) +
    ((hasConst || hasLet) ? 1 : 0) +
    (hasFunction || /=>\s*\{/.test(first100Lines) || /function\s+\w+\s*\(/.test(first100Lines) ? 2 : 0) +
    (/\b(console\.|document\.|window\.|require\(|module\.exports|exports\.|async\s+function|await\s+|Object\.|Array\.|alert\()\b/.test(first100Lines) ? 2 : 0) +
    (hasCurlyBraces && hasSemicolon ? 1 : 0) +
    (/\bvar\s+\w+\s*=/.test(first100Lines) ? 1 : 0)
  );
  
  if (jsScore >= 3) {
    return 'javascript';
  }
  
  return null;
};
