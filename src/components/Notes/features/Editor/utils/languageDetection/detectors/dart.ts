import type { LanguageDetector } from '../types';

export const detectDart: LanguageDetector = (ctx) => {
  const { first100Lines, hasCurlyBraces, hasSemicolon } = ctx;

  if (/\b(import\s+['"]dart:|import\s+['"]package:)\b/.test(first100Lines)) {
    return 'dart';
  }

  if (/\b(library\s+\w+;|part\s+of\s+['"]|part\s+['"])\b/.test(first100Lines)) {
    return 'dart';
  }

  if (/@dart\s*=/.test(first100Lines) || /\/\/\s*dart\s+format/.test(first100Lines)) {
    return 'dart';
  }

  if (!hasCurlyBraces || !hasSemicolon) {
    return null;
  }

  if (/\b(import\s+.*from|export\s+(default|const|function)|console\.|alert\()\b/.test(first100Lines)) {
    return null;
  }

  if (/\bclass\s+\w+\s+extends\s+\$\w+/.test(first100Lines)) {
    return 'dart';
  }

  if (/\b(void\s+main|@override)\b/i.test(first100Lines)) {
    if (/\b(Future<|Stream<|final\s+\w+|const\s+\w+|dynamic\s+\w+)\b/.test(first100Lines)) {
      return 'dart';
    }
  }

  return null;
};
