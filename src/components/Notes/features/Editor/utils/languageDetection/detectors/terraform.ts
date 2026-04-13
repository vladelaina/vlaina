import type { LanguageDetector } from '../types';

export const detectTerraform: LanguageDetector = (ctx) => {
  const { code } = ctx;

  if (/\bterraform\s*\{/.test(code) && /\brequired_version\s*=/.test(code)) {
    return 'terraform';
  }

  if (/\b(resource|provider|variable|output|module|data|locals|terraform)\s+"[\w-]+"/.test(code)) {
    return 'terraform';
  }

  if (/\b(resource|provider|variable|output|module)\s+"\w+"/.test(code)) {
    return 'terraform';
  }

  return null;
};
