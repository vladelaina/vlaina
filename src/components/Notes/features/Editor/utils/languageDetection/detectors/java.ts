import type { LanguageDetector } from '../types';

export const detectJava: LanguageDetector = (ctx) => {
  const { first100Lines, sample } = ctx;
  
  // Strong Java indicators - package and import statements
  if (/^package\s+[\w.]+;/m.test(first100Lines) || /^import\s+java\./m.test(first100Lines)) {
    return 'java';
  }
  
  // Java-specific imports
  if (/^import\s+(org\.(apache|jooq|intellij|junit)|com\.intellij)\./m.test(first100Lines)) {
    return 'java';
  }
  
  // Java class declarations with modifiers
  if (/\b(public|private|protected)\s+(static\s+)?(class|interface|enum)\s+\w+/.test(first100Lines)) {
    if (/\b(public\s+static\s+void\s+main|System\.out\.|@Override|@SuppressWarnings|extends\s+\w+|implements\s+\w+)\b/.test(first100Lines)) {
      return 'java';
    }
  }
  
  return null;
};
