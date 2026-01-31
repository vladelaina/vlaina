import type { LanguageDetector } from '../types';

export const detectShell: LanguageDetector = (ctx) => {
  const { first100Lines, firstLine, lines } = ctx;
  
  // Shell set commands at the start
  if (/^set\s+-[euxo]/.test(firstLine)) {
    return 'bash';
  }
  
  // Incomplete shebang (#!/usr/bin/env without interpreter) + shell commands
  if (/^#!\/usr\/bin\/env\s*$/m.test(firstLine)) {
    if (/\b(echo|export|source|cd|ls|grep|awk|sed)\b/.test(first100Lines)) {
      return 'bash';
    }
  }
  
  // Shell-specific patterns
  if (/\b(echo|export|source|alias|cd|ls|grep|awk|sed|chmod|chown)\b/.test(first100Lines)) {
    const shellScore = (
      (/\$\{?\w+\}?/.test(first100Lines) ? 2 : 0) +
      (/\b(if\s+\[|then|fi|elif|else|case|esac|for\s+\w+\s+in|while|do|done)\b/.test(first100Lines) ? 2 : 0) +
      (lines.slice(0, 20).filter(l => l.trim().startsWith('#') && !l.includes('include')).length > 2 ? 1 : 0) +
      (/\|\s*\w+|\w+\s*\|/.test(first100Lines) ? 1 : 0) +
      (/^(echo|cd|make|cmake)\s+/m.test(first100Lines) ? 1 : 0)
    );
    
    if (shellScore >= 3) {
      return 'bash';
    }
  }
  
  return null;
};
