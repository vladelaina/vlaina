import type { LanguageDetector } from '../types';

export const detectKotlin: LanguageDetector = (ctx) => {
  const { sample, first100Lines, hasCurlyBraces, hasSemicolon } = ctx;
  
  if (!hasCurlyBraces) {
    return null;
  }
  
  // Exclude Go files (Go has package but different syntax)
  if (/^package\s+\w+$/m.test(first100Lines) && /\bfunc\s+\w+/.test(first100Lines)) {
    return null;
  }
  
  // Strong Kotlin indicators - package with import
  if (/^package\s+[\w.]+$/m.test(first100Lines) && /^import\s+[\w.]+/.test(first100Lines)) {
    if (/\b(fun\s+\w+|val\s+\w+|var\s+\w+:\s*\w+|class\s+\w+|object\s+\w+|interface\s+\w+|data\s+class)\b/.test(first100Lines)) {
      return 'kotlin';
    }
  }
  
  // Kotlin-specific patterns
  if (/\b(fun\s+\w+|data\s+class|sealed\s+class|companion\s+object)\b/.test(first100Lines)) {
    if (sample.includes('?.') ||
        sample.includes('!!') ||
        /\b(suspend|inline|reified|when\s*\{)\b/.test(first100Lines) ||
        !hasSemicolon) {
      return 'kotlin';
    }
  }
  
  return null;
};
