import type { LanguageDetector } from '../types';

export const detectR: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

  if (/^#!.*\bescript\b/.test(firstLine)) {
    return null;
  }

  if (/^#'/m.test(first100Lines)) {
    return 'r';
  }

  if (/^\\(name|alias|title|usage|arguments|value|description|details|docType)\{/m.test(first100Lines)) {
    return 'r';
  }

  if (/^##[\w=]+/m.test(first100Lines)) {

    if (/^##\w+=\w+/m.test(first100Lines)) {
      return 'r';
    }
  }

  if (/^#{1,6}\s+/m.test(first100Lines)) {

    if (/^##\s+(SYNOPSIS|DESCRIPTION|OPTIONS|EXAMPLES|SEE ALSO|AUTHOR)/m.test(first100Lines)) {
      return null;
    }
  }

  if (/^package\s+[\w:]+;/m.test(first100Lines) ||
      /^use\s+(strict|warnings|lib)\b/m.test(first100Lines) ||
      (/^sub\s+\w+\s*\{/m.test(first100Lines) && /[\$@%][\w]+/.test(first100Lines))) {
    return null;
  }

  if (/^\(ns\s+[\w.-]+|^\((def|defn|defmacro|deftask|set-env!|task-options!)\s+/m.test(first100Lines)) {
    return null;
  }

  if (/^;;/.test(first100Lines) && /^\(/m.test(first100Lines)) {
    return null;
  }

  if (/^module\s+[A-Z][\w.]*\s+exposing/.test(first100Lines) || /^import\s+[A-Z][\w.]*\s+exposing/.test(first100Lines)) {
    return null;
  }

  if (/->|=>/.test(code)) {

    if (/\brequire\s+['"]/.test(first100Lines) || /\w+\s*=\s*\([^)]*\)\s*->/.test(code)) {
      return null;
    }
  }

  if (/^[\w-]+\s*$/m.test(first100Lines) && /^\s+[\w-]+\s+/.test(first100Lines) && !/\{/.test(first100Lines)) {
    return null;
  }

  if (/\b(def\s+\w+|class\s+\w+|module\s+\w+)\b/.test(first100Lines) && /\bend\b/.test(code)) {
    return null;
  }

  if (/^library\s*\(|^require\s*\(/m.test(first100Lines)) {
    return 'r';
  }

  if (/<-|->/.test(code)) {

    if (/\b(library|require|data\.frame|function|c\(|matrix|plot|ggplot|set\.seed|options|str\(|summary\(|head\(|tail\()\b/.test(first100Lines)) {
      return 'r';
    }
  }

  if (/\b(library|require|data\.frame|set\.seed|options|str|summary|head|tail)\s*\(/.test(first100Lines)) {
    return 'r';
  }

  if (/\w+\s*<-\s*function\s*\(/.test(code)) {
    return 'r';
  }

  if (/%>%|%\|\|%/.test(code)) {
    if (/\b(library|require|data\.frame|c\()\b/.test(first100Lines)) {
      return 'r';
    }
  }

  if (/\b(mutate|filter|select|arrange|summarize|group_by|left_join|right_join|inner_join)\s*\(/.test(code)) {
    if (/<-/.test(code)) {
      return 'r';
    }
  }

  return null;
};
