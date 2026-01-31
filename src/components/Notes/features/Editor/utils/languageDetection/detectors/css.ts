import type { LanguageDetector } from '../types';

export const detectCSS: LanguageDetector = (ctx) => {
  const { first100Lines, hasCurlyBraces } = ctx;
  
  if (!hasCurlyBraces) {
    return null;
  }
  
  // CSS selectors and properties
  if (/[.#][\w-]+\s*\{/.test(first100Lines) || 
      /^[\w-]+\s*\{/.test(first100Lines) ||
      /@(media|import|keyframes|font-face)/.test(first100Lines)) {
    
    // Check for common CSS properties
    if (/\b(color|background|margin|padding|border|width|height|display|position|font-size|font-family):\s*[^;]+;/.test(first100Lines)) {
      return 'css';
    }
    
    // Check for CSS units
    if (/\d+(px|em|rem|%|vh|vw|pt|cm|mm|in)\b/.test(first100Lines)) {
      return 'css';
    }
    
    // Check for CSS color values
    if (/#[0-9a-fA-F]{3,6}\b|rgb\(|rgba\(|hsl\(|hsla\(/.test(first100Lines)) {
      return 'css';
    }
  }
  
  // SCSS/SASS specific patterns (also return 'css' for now)
  if (/\$[\w-]+:\s*[^;]+;/.test(first100Lines) || 
      /@mixin|@include|@extend/.test(first100Lines)) {
    return 'scss';
  }
  
  return null;
};
