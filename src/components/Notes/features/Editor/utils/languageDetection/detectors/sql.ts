import type { LanguageDetector } from '../types';

export const detectSQL: LanguageDetector = (ctx) => {
  const { first100Lines, firstLine } = ctx;

  if (/^\s*(def|class|from|import|const|let|var|function)\s+/.test(firstLine)) {
    return null;
  }

  if (/#include\s*[<"]/.test(first100Lines)) {
    if (!/\b(CREATE\s+INDEX|CREATE\s+UNIQUE\s+INDEX)\b/i.test(first100Lines)) {
      return null;
    }
  }

  if (/\b(CREATE\s+INDEX|CREATE\s+UNIQUE\s+INDEX)\b/i.test(first100Lines)) {
    if (/\bWHERE\s+\w+/.test(first100Lines) || /\bON\s+\w+\s*\(/.test(first100Lines)) {
      return 'sql';
    }
    return 'sql';
  }

  if (/^#{1,6}\s+\w+/m.test(first100Lines)) {

    if (!/\b(SELECT\s+.*\s+FROM|INSERT\s+INTO|CREATE\s+TABLE|DROP\s+TABLE)\b/i.test(first100Lines)) {
      return null;
    }
  }

  const hasStrongKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE\s+(TABLE|PROCEDURE|FUNCTION|VIEW|INDEX)|DROP\s+(TABLE|PROCEDURE|FUNCTION|VIEW)|ALTER\s+TABLE|GRANT|SHOW\s+WARNINGS)\b/i.test(first100Lines);

  if (!hasStrongKeywords) {
    return null;
  }

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
