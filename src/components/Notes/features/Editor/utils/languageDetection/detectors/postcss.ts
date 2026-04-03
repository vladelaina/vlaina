import type { LanguageDetector } from '../types';

export const detectPostCSS: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  // PostCSS @apply directive
  if (/@apply\s+/.test(code)) {
    return 'postcss';
  }

  // PostCSS custom properties
  if (/@custom-media|@custom-selector/.test(code)) {
    return 'postcss';
  }

  // PostCSS mixins
  if (/@define-mixin\b/.test(code)) {
    return 'postcss';
  }

  if (/\btheme\s*\(/.test(code) &&
      /\{/.test(code) &&
      /\b(color|background|margin|padding|border|width|height|display|position|font-size|font-family)\s*:/.test(code)) {
    return 'postcss';
  }

  // PostCSS with modern CSS features - but these are also valid CSS
  // Only return postcss if there are PostCSS-specific features
  if (/@media\s*\([^)]*\)\s*\{/.test(code) && /grid-template-columns|repeat\(auto-fit/.test(code)) {
    // Check for PostCSS-specific features
    if (/@apply|theme\(|@custom-/.test(code)) {
      return 'postcss';
    }
    // Otherwise, let CSS handle it
    return null;
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
