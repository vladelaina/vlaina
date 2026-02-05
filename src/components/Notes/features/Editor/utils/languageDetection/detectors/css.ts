import type { LanguageDetector } from '../types';

export const detectCSS: LanguageDetector = (ctx) => {
  const { first100Lines, hasCurlyBraces, code } = ctx;

  if (!hasCurlyBraces) {
    return null;
  }

  if (/^require\s+['"]/.test(first100Lines) ||
      (/^class\s+\w+/m.test(first100Lines) && /\b(attr_reader|attr_accessor|attr_writer|def\s+\w+|include\s+\w+)\b/.test(first100Lines))) {
    return null;
  }

  if (/<!DOCTYPE\s+html/i.test(first100Lines) || /<html[\s>]/i.test(first100Lines)) {
    return null;
  }

  if (/\$[\w-]+:\s*[^;]+;/.test(first100Lines)) {
    return null;
  }

  if (/@[\w-]+:\s*[^;]+;/.test(first100Lines) && /@import|\.[\w-]+\([^)]*\)\s*\{/.test(code)) {
    return null;
  }

  if (/@custom-media|@custom-selector|@apply/.test(first100Lines)) {
    return null;
  }

  // CSS custom properties (variables): :root { --primary-color: #007bff; }
  if (/:root\s*\{/.test(code) && /--[\w-]+:\s*[^;]+;/.test(code)) {
    return 'css';
  }
  
  // CSS @keyframes animation
  if (/@keyframes\s+[\w-]+\s*\{/.test(code)) {
    return 'css';
  }

  if (/[.#][\w-]+\s*\{/.test(first100Lines) ||
      /^[\w-]+\s*\{/.test(first100Lines) ||
      /@(media|import|keyframes|font-face)/.test(first100Lines)) {

    if (/\b(color|background|margin|padding|border|width|height|display|position|font-size|font-family):\s*[^;]+;/.test(first100Lines)) {
      return 'css';
    }

    if (/\d+(px|em|rem|%|vh|vw|pt|cm|mm|in)\b/.test(first100Lines)) {
      return 'css';
    }

    if (/#[0-9a-fA-F]{3,6}\b|rgb\(|rgba\(|hsl\(|hsla\(/.test(first100Lines)) {
      return 'css';
    }
  }

  return null;
};
