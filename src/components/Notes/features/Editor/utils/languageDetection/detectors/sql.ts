import type { LanguageDetector } from '../types';

export const detectSQL: LanguageDetector = (ctx) => {
  const { first100Lines, sample } = ctx;
  
  // Exclude Markdown files (has # headers and no SQL keywords)
  if (/^#{1,6}\s+\w+/m.test(first100Lines)) {
    // If it has Markdown headers, it's probably Markdown unless it has strong SQL patterns
    if (!/\b(SELECT\s+.*\s+FROM|INSERT\s+INTO|CREATE\s+TABLE|DROP\s+TABLE)\b/i.test(first100Lines)) {
      return null;
    }
  }
  
  // Strong SQL keywords
  const hasStrongKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE\s+(TABLE|PROCEDURE|FUNCTION|VIEW|INDEX)|DROP\s+(TABLE|PROCEDURE|FUNCTION|VIEW)|ALTER\s+TABLE|GRANT|SHOW\s+WARNINGS)\b/i.test(first100Lines);
  
  if (!hasStrongKeywords) {
    return null;
  }
  
  // SQL-specific patterns
  const sqlScore = (
    (/\b(SELECT\s+.*\s+FROM|INSERT\s+INTO|UPDATE\s+.*\s+SET|DELETE\s+FROM|CREATE\s+TABLE)\b/i.test(first100Lines) ? 3 : 0) +
    (/\b(DROP\s+(TABLE|PROCEDURE|FUNCTION|VIEW|TYPE)|ALTER\s+TABLE)\b/i.test(first100Lines) ? 3 : 0) +
    (/\b(WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|HAVING|PRIMARY\s+KEY|FOREIGN\s+KEY)\b/i.test(first100Lines) ? 2 : 0) +
    (/\b(VARCHAR|INT|INTEGER|BIGINT|DECIMAL|DATETIME|TIMESTAMP|NOT\s+NULL|AUTO_INCREMENT)\b/i.test(first100Lines) ? 2 : 0) +
    (/;[\s\n]*$/m.test(first100Lines) ? 1 : 0) +
    (/--\s+/.test(first100Lines) ? 1 : 0)
  );
  
  if (sqlScore >= 3) {
    return 'sql';
  }
  
  return null;
};
