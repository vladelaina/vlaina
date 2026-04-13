import type { LanguageDetector } from '../types';

export const detectHaml: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/#include\s*[<"]/.test(first100Lines) || /\b(printf|scanf|fprintf|fscanf|malloc|calloc|realloc|free|sizeof)\s*\(/.test(code)) {
    return null;
  }

  if (/^%\s/m.test(first100Lines) && /\bfunction\b/.test(first100Lines)) {
    return null;
  }

  if (/^use\s+(strict|warnings|v\d+|lib)\b/m.test(first100Lines) ||
      /^package\s+[\w:]+;/m.test(first100Lines) ||
      /^=head\d+\s+/m.test(first100Lines)) {
    return null;
  }

  if (/@(interface|implementation|property)\b/.test(first100Lines) ||
      /#import\s+["<]/.test(first100Lines)) {
    return null;
  }

  // Haml tag: %h1 Hello World
  if (/^%(h[1-6]|html|head|body|div|span|p|a|li|td|th|button|label)(\s|$|[.#])/m.test(code)) {
    return 'haml';
  }

  if (/^%[\w-]+/m.test(code)) {

    if (/^%[\w-]+[.#][\w-]+|^%[\w-]+\{/.test(code)) {
      return 'haml';
    }

    if (/^%[a-z]+\s*$/m.test(code)) {
      return 'haml';
    }
  }

  if (/^[.#][\w-]+/m.test(code)) {

    if (/%[\w-]+|^-\s*|^=\s*/.test(code)) {
      return 'haml';
    }
  }

  if (/^-\s*\w+|^=\s*\w+/.test(code)) {

    if (/%[\w-]+/.test(code)) {
      return 'haml';
    }
  }

  return null;
};
