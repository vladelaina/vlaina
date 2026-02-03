import type { LanguageDetector } from '../types';

export const detectDotenv: LanguageDetector = (ctx) => {
  const { lines } = ctx;

  const envPattern = /^[A-Z_][A-Z0-9_]*=/;

  let envLines = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (envPattern.test(trimmed)) {
      envLines++;
    }
  }

  if (envLines >= 2) {
    return 'dotenv';
  }

  return null;
};
