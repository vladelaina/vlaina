import type { LanguageDetector } from '../types';

export const detectXML: LanguageDetector = (ctx) => {
  const { code, firstLine } = ctx;

  if (/\{%[\s\S]*?%\}/.test(code) && /\{\{[\s\S]*?\|[\s\S]*?\}\}/.test(code)) {
    return null;
  }

  if (/\{%\s*(extends|block|macro|set|import)\b/.test(code)) {
    return null;
  }

  if (firstLine.includes('<Query Kind=')) {
    return null;
  }

  if (firstLine.includes('<?xml')) {

    if (/<html\s+xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/.test(code)) {
      return null;
    }
    return 'xml';
  }

  const trimmed = code.trim();
  if (!trimmed.startsWith('<') || !trimmed.includes('>')) {
    return null;
  }

  if (/<\?xml|xmlns[:=]|<\w+:\w+/.test(code)) {

    if (/xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/.test(code)) {
      return null;
    }
    return 'xml';
  }

  if (/<[a-zA-Z][\w:.-]*[^>]*>/.test(code) &&
      !/<(html|head|body|div|span|p|a|img|script|style|link|meta)\b/i.test(code)) {
    return 'xml';
  }

  return null;
};
