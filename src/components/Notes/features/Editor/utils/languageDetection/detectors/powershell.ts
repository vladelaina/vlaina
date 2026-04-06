import type { LanguageDetector } from '../types';

export const detectPowerShell: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/^use\s+(strict|warnings|v\d+)/m.test(first100Lines) || /^package\s+[\w:]+;/m.test(first100Lines)) {
    return null;
  }

  if (/^#!.*bash/.test(first100Lines) || /(^|\n)\s*(echo\s+|if\s+\[|then\b|fi\b|for\s+\w+\s+in)/.test(first100Lines)) {
    return null;
  }

  // PowerShell cmdlets (must be before Perl check)
  if (/\b(Get|Set|New|Remove|Add|Clear|Write|Read|Test|Start|Stop|Invoke|Import|Export)-[A-Z]\w+/.test(code)) {
    return 'powershell';
  }

  // PowerShell variables and functions
  if (/^function\s+\w+/.test(first100Lines) && /\$[\w]+/.test(first100Lines)) {
    // Check for PowerShell-specific syntax
    if (/\$global:|@\{|@\(|\[datetime\]|\[array\]|\[string\]|\[Parameter/.test(code)) {
      return 'powershell';
    }
    // PowerShell function with param block
    if (/param\s*\(/.test(code)) {
      return 'powershell';
    }
  }

  // PowerShell $variable with cmdlets
  if (/\$[\w]+\s*=\s*(Get|Set|New)-[A-Z]\w+/.test(code)) {
    return 'powershell';
  }

  if (/\$[\w]+/.test(code)) {

    if (/\bparam\s*\(|\[Parameter\(|\[CmdletBinding\(/.test(code)) {
      return 'powershell';
    }
  }

  if (/\|\s*(ForEach-Object|Where-Object|Select-Object)/.test(code)) {
    return 'powershell';
  }

  if (/\bfunction\s+\w+-\w+/.test(code)) {
    return 'powershell';
  }

  return null;
};
