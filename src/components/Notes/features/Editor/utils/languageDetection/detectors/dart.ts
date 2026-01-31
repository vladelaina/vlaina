import type { LanguageDetector } from '../types';

export const detectDart: LanguageDetector = (ctx) => {
  const { sample, first100Lines, hasCurlyBraces, hasSemicolon } = ctx;
  
  // Strong Dart indicators - import 'dart:' or 'package:' (highest priority)
  if (/\b(import\s+['"]dart:|import\s+['"]package:)\b/.test(first100Lines)) {
    return 'dart';
  }
  
  // Dart part directive - part of 'file.dart';
  if (/\b(library\s+\w+;|part\s+of\s+['"]|part\s+['"])\b/.test(first100Lines)) {
    return 'dart';
  }
  
  // Dart-specific patterns - @dart annotation or // dart format
  if (/@dart\s*=/.test(first100Lines) || /\/\/\s*dart\s+format/.test(first100Lines)) {
    return 'dart';
  }
  
  if (!hasCurlyBraces || !hasSemicolon) {
    return null;
  }
  
  // Exclude TypeScript/JavaScript files
  if (/\b(import\s+.*from|export\s+(default|const|function)|console\.|alert\()\b/.test(first100Lines)) {
    return null;
  }
  
  // Dart class with extends
  if (/\bclass\s+\w+\s+extends\s+\$\w+/.test(first100Lines)) {
    return 'dart';
  }
  
  // Dart-specific patterns - need strong evidence
  if (/\b(void\s+main|@override)\b/i.test(first100Lines)) {
    if (/\b(Future<|Stream<|final\s+\w+|const\s+\w+|dynamic\s+\w+)\b/.test(first100Lines)) {
      return 'dart';
    }
  }
  
  return null;
};
