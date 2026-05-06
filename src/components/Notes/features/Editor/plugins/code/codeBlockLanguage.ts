import { codeBlockLanguageLoader } from './codeBlockLanguageLoader';

const CODE_BLOCK_LANGUAGE_CLASS_PATTERN = /language-([\w+-]+)/;
const CODE_BLOCK_FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\r\n]*)$/;

export function parseCodeLanguageFromClassName(className: string) {
  const match = CODE_BLOCK_LANGUAGE_CLASS_PATTERN.exec(className);
  return match?.[1] ?? null;
}

export function parseCodeFenceLanguage(text: string) {
  const match = CODE_BLOCK_FENCE_PATTERN.exec(text.replace(/[ \t]+$/g, ''));
  if (!match) {
    return null;
  }

  const openingMarker = match[1] ?? '';
  const infoString = match[2]?.trim() ?? '';
  if (openingMarker[0] === '`' && infoString.includes('`')) {
    return null;
  }

  return infoString.split(/\s+/)[0] ?? '';
}

export function normalizeCodeBlockLanguage(languageName: string | null | undefined) {
  return codeBlockLanguageLoader.normalizeLanguageId(languageName);
}
