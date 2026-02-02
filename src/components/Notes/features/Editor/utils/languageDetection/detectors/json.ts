import type { LanguageDetector } from '../types';

export const detectJSON: LanguageDetector = (ctx) => {
  const { code, firstLine } = ctx;

  const trimmed = code.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }

  try {
    JSON.parse(trimmed);
    return 'json';
  } catch {
    return null;
  }
};
