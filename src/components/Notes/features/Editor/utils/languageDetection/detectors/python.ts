import type { LanguageDetector } from '../types';

export const detectPython: LanguageDetector = (ctx) => {
  const { firstLine, first100Lines, lines, hasCurlyBraces } = ctx;
  
  if (firstLine.startsWith('# -*- coding:') || firstLine.startsWith('# coding:')) {
    return 'python';
  }
  
  // Exclude Scala files - check for Scala imports
  if (/^import\s+scala\./m.test(first100Lines) || /^import\s+math\.random$/m.test(first100Lines)) {
    return null;
  }
  
  if (!/\b(def\s+\w+|class\s+\w+|import\s+\w+|from\s+\w+\s+import|if\s+.*:|elif\s+.*:|else:|print\(|lambda\s+|with\s+.*:|async\s+def|@\w+\s*\n\s*def)\b/.test(first100Lines)) {
    return null;
  }
  
  const pythonScore = (
    (/\b(def\s+\w+\s*\(|class\s+\w+\s*:)/.test(first100Lines) ? 2 : 0) +
    (/\b(self|__init__|__name__|__main__|None|True|False|range\(|append\(|len\()\b/.test(first100Lines) ? 2 : 0) +
    (/^(def|class|import|from)\s+/.test(firstLine) ? 1 : 0) +
    (lines.slice(0, 20).filter(l => /^\s{4}|\t/.test(l)).length > 2 ? 1 : 0) +
    (!hasCurlyBraces ? 1 : 0)
  );
  
  if (pythonScore >= 3) {
    return 'python';
  }
  
  return null;
};
