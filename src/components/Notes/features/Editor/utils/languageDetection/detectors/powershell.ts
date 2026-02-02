import type { LanguageDetector } from '../types';

export const detectPowerShell: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/^use\s+(strict|warnings|v\d+)/m.test(first100Lines) || /^package\s+[\w:]+;/m.test(first100Lines)) {
    return null;
  }

  if (/^#!.*bash/.test(first100Lines) || /\b(echo|if\s+\[|then|fi|for\s+\w+\s+in)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(Get|Set|New|Remove|Add|Clear|Write|Read|Test|Start|Stop|Invoke|Import|Export)-[A-Z]\w+/.test(code)) {
    return 'powershell';
  }

  if (/^function\s+\w+/.test(first100Lines) && /\$[\w]+/.test(first100Lines)) {

    if (/\$global:|@\{|@\(|\[datetime\]|\[array\]|\[string\]/.test(code)) {
      return 'powershell';
    }
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
