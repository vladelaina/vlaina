import type { LanguageDetector } from '../types';

export const detectGo: LanguageDetector = (ctx) => {
  const { first100Lines, sample } = ctx;
  
  // Must have package declaration
  if (!/^package\s+\w+$/m.test(first100Lines)) {
    return null;
  }
  
  // Strong Go indicators
  if (/\b(func\s+\w+|type\s+\w+\s+struct|type\s+\w+\s+interface)\b/.test(first100Lines)) {
    if (/\b(chan|go\s+func|defer|interface\s*\{|make\(|range\s+)\b/.test(first100Lines) || 
        sample.includes(':=') ||
        /`json:"/.test(first100Lines) ||
        /\bfunc\s+init\s*\(\)/.test(first100Lines)) {
      return 'go';
    }
  }
  
  // Package + any Go-specific syntax
  if (sample.includes(':=') || 
      /`\w+:"/.test(first100Lines) ||
      /\b(chan|defer|goroutine)\b/.test(first100Lines)) {
    return 'go';
  }
  
  return null;
};
