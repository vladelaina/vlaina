import type { LanguageDetector } from '../types';

export const detectGraphQL: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/^package\s+[\w.]+;/m.test(code) || /^import\s+java\./m.test(code)) {
    return null;
  }

  const graphqlKeywords = /\b(type|query|mutation|subscription|fragment|schema|input|interface|union|enum|scalar|directive|extend|implements)\b/;

  if (!graphqlKeywords.test(code)) {
    return null;
  }

  if (/type\s+\w+\s*\{/.test(code)) {
    return 'graphql';
  }

  if (/(query|mutation|subscription)\s+\w*\s*\{/.test(code)) {
    return 'graphql';
  }

  if (/schema\s*\{/.test(code)) {
    return 'graphql';
  }

  return null;
};
