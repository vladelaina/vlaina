import type { LanguageDetector } from '../types';

export const detectPostCSS: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/@custom-media|@custom-selector/.test(code)) {
    return 'postcss';
  }

  if (/@define-mixin\b/.test(code)) {
    return 'postcss';
  }

  if (/\$[\w-]+\s*:/.test(first100Lines) && /@(mixin|include)\b/.test(first100Lines) && !/@define-mixin\b/.test(code)) {
    return null;
  }

  if (/&\s*\{|&:[\w-]+|&\.[\w-]+/.test(code)) {

    if (/@apply|theme\(/.test(code)) {
      return 'postcss';
    }
  }

  return null;
};
