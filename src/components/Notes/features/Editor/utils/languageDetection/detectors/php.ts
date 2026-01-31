import type { LanguageDetector } from '../types';

export const detectPHP: LanguageDetector = (ctx) => {
  const { firstLine, sample, first100Lines, hasConst, hasLet } = ctx;
  
  if (firstLine.startsWith('<?php') || sample.includes('<?php')) {
    return 'php';
  }

  if (sample.includes('<?php') || sample.includes('<?=')) {
    return 'php';
  }
  
  if (/\$[\w]+\s*=/.test(first100Lines) && /\b(echo|print|function|class|namespace|use|require|include)\b/.test(first100Lines)) {
    if (!hasConst && !hasLet) {
      return 'php';
    }
  }
  
  return null;
};
