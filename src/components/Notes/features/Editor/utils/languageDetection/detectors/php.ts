import type { LanguageDetector } from '../types';

export const detectPHP: LanguageDetector = (ctx) => {
  const { firstLine, sample, first100Lines, hasConst, hasLet } = ctx;

  if (firstLine.startsWith('<?php') || sample.includes('<?php') || sample.includes('<?=')) {
    return 'php';
  }

  if (/\b(server|location|listen|root|index|proxy_pass)\s+/.test(first100Lines)) {
    return null;
  }

  if (/\b(Get|Set|New|Remove|Add|Clear|Write|Read|Test|Start|Stop|Invoke|Import|Export)-[A-Z]\w+/.test(first100Lines)) {
    return null;
  }

  if (/^use\s+(strict|warnings|v\d+|feature)/.test(first100Lines) || /^package\s+\w+;/.test(first100Lines)) {
    return null;
  }

  if (/<-/.test(first100Lines) && /\b(library|function|data\.frame|c\()\b/.test(first100Lines)) {
    return null;
  }

  if (/\$[\w]+\s*=/.test(first100Lines)) {

    if (/\b(echo|print|function|class|namespace|use|require|include|foreach|elseif)\b/.test(first100Lines)) {

      if (!hasConst && !hasLet && !/\b(import|export|const|let|var)\b/.test(first100Lines)) {

        if (/\$\w+->\w+|\$\w+\[['"]/.test(first100Lines) ||
            /\bfunction\s+\w+\s*\([^)]*\$/.test(first100Lines)) {
          return 'php';
        }
      }
    }
  }

  return null;
};
