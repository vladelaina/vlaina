import type { LanguageDetector } from '../types';

export const detectShell: LanguageDetector = (ctx) => {
  const { first100Lines, firstLine, lines, code } = ctx;

  if (/^#'/m.test(first100Lines)) {
    return null;
  }

  if (/^\\(name|alias|title|usage|arguments|value|description|details|docType)\{/m.test(first100Lines)) {
    return null;
  }

  if (/^package\s+[\w.]+;/m.test(code) || /^import\s+java\./m.test(code)) {
    return null;
  }

  if (/^function\s+\w+/.test(first100Lines)) {
    if (/\$global:|@\{|@\(|\[datetime\]|\[array\]|\[string\]|\$now\s*=\s*\[datetime\]/.test(first100Lines) ||
        /\b(Get|Set|New|Remove|Add|Test|Update)-[A-Z]\w+/.test(first100Lines) ||
        /Test-Path|Get-Variable/.test(first100Lines)) {
      return null;
    }
  }

  if (/\b(Test-Path|Get-Variable|Add-\w+|Update-\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(proc\s+\w+|import\s+\w+|when\s+defined\(|task\s+\w+,|switch\()\b/.test(first100Lines)) {
    return null;
  }

  if (/->|=>/.test(first100Lines)) {
    return null;
  }

  // Pipe patterns: cat file.txt | grep "error" | wc -l
  if (/\|/.test(code)) {
    const pipeCount = (code.match(/\|/g) || []).length;
    if (pipeCount >= 2 && lines.length <= 3) {
      // Check for common shell commands
      if (/\b(cat|grep|awk|sed|wc|sort|uniq|head|tail|cut|tr)\b/.test(code)) {
        return 'bash';
      }
    }
  }
  
  // Shell function definition: function backup() {
  if (/^function\s+\w+\s*\(\s*\)\s*\{/m.test(code)) {
    // Make sure it's not PowerShell or other languages
    if (!/\b(param|Get-|Set-|New-|Test-)\b/.test(code)) {
      return 'bash';
    }
  }

  // Simple single-line shell patterns
  if (lines.length <= 3) {
    if (/^echo\s+/.test(code.trim())) {
      return 'bash';
    }
  }

  if (/\b(find|docker|curl|wget|git|npm|yarn|pip|apt|yum)\s+/.test(code)) {
    if (lines.length <= 3) {
      return 'bash';
    }
  }

  if (/^(find|docker|curl|wget|git|npm|yarn)\s+/.test(firstLine)) {
    return 'bash';
  }

  // Shell if statement
  if (/\bif\s+\[/.test(code) && /\bthen\b/.test(code) && /\bfi\b/.test(code)) {
    return 'bash';
  }

  if (/^set\s+-[euxo]/.test(firstLine)) {
    return 'bash';
  }

  if (/^#!\/usr\/bin\/env\s*$/m.test(firstLine)) {
    if (/\b(echo|export|source|cd|ls|grep|awk|sed)\b/.test(first100Lines)) {
      return 'bash';
    }
  }

  if (/^awk\s+['"]/.test(code)) {
    return 'bash';
  }

  if (/^sed\s+-i\s+/.test(code)) {
    return 'bash';
  }

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
