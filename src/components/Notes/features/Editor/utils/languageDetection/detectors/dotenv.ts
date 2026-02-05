import type { LanguageDetector } from '../types';

export const detectDotenv: LanguageDetector = (ctx) => {
  const { lines } = ctx;

  // Dotenv pattern: KEY=value
  const envPattern = /^[A-Z_][A-Z0-9_]*=/;

  // Single line dotenv
  if (lines.length === 1) {
    const trimmed = lines[0].trim();
    if (envPattern.test(trimmed) && /=\w+:\/\//.test(trimmed)) {
      return 'dotenv';
    }
  }

  // Multiple lines of environment variables
  let envLines = 0;
  let makefileLines = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Check for Makefile patterns
    if (/^\w+:/.test(trimmed) || /^\t/.test(line)) {
      makefileLines++;
    }
    
    // Check for dotenv patterns
    if (envPattern.test(trimmed) && !/^\w+:/.test(trimmed)) {
      envLines++;
    }
  }

  // If we have more env lines than makefile lines, it's dotenv
  if (envLines >= 2 && envLines > makefileLines) {
    return 'dotenv';
  }

  return null;
};
