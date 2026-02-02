import type { LanguageDetector } from '../types';

export const detectPrisma: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/@[\w-]+:\s*[^;]+;/.test(first100Lines)) {
    return null;
  }

  if (/\b(datasource|generator|model|enum)\s+\w+\s*\{/.test(code)) {

    if (/provider\s*=|url\s*=|@id|@unique|@default|@relation/.test(code)) {
      return 'prisma';
    }
  }

  if (/datasource\s+db\s*\{/.test(code)) {
    return 'prisma';
  }

  return null;
};
