import type { LanguageDetector } from '../types';

export const detectJava: LanguageDetector = (ctx) => {
  const { first100Lines, code } = ctx;

  if (/^use\s+(strict|warnings|lib)\b/m.test(first100Lines)) {
    return null;
  }

  if (/^package\s+[\w:]+;/m.test(first100Lines) && /\b(my|our|local)\s+[\$@%]|\$\w+\s*=/.test(first100Lines)) {
    return null;
  }

  if (/\b(type\s+\w+\s*\{|interface\s+\w+\s*\{|query\s+\w+\s*\{|mutation\s+\w+\s*\{)\b/.test(first100Lines)) {
    return null;
  }

  if (/@[\w-]+\s*:/.test(first100Lines) && /\{[\s\S]*?\}/.test(first100Lines)) {
    return null;
  }

  if (/^package\s+[\w.]+;/m.test(code) || /^import\s+java\./m.test(code)) {
    return 'java';
  }

  if (/^import\s+(org\.(apache|jooq|intellij|junit)|com\.intellij)\./m.test(code)) {
    return 'java';
  }

  if (/\b(public|private|protected)\s+(static\s+)?(class|interface|enum)\s+\w+/.test(first100Lines)) {
    if (/\b(public\s+static\s+void\s+main|System\.out\.|@Override|@SuppressWarnings|extends\s+\w+|implements\s+\w+)\b/.test(first100Lines)) {
      return 'java';
    }
  }

  return null;
};
