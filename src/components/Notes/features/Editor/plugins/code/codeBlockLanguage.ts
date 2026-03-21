import { codeBlockLanguageLoader } from './codeBlockLanguageLoader';

const CODE_BLOCK_LANGUAGE_CLASS_PATTERN = /language-([\w+-]+)/;
const CODE_BLOCK_FENCE_PATTERN = /^```([\w+-]*)$/;

export function parseCodeLanguageFromClassName(className: string) {
  const match = CODE_BLOCK_LANGUAGE_CLASS_PATTERN.exec(className);
  return match?.[1] ?? null;
}

export function parseCodeFenceLanguage(text: string) {
  const match = CODE_BLOCK_FENCE_PATTERN.exec(text);
  if (!match) {
    return null;
  }

  return match[1] ?? '';
}

export function normalizeCodeBlockLanguage(languageName: string | null | undefined) {
  return codeBlockLanguageLoader.normalizeLanguageId(languageName);
}
