import { MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS } from './composerFocusRegistry';

export function limitChatComposerText(value: string): string {
  return value.length > MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS
    ? value.slice(0, MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS)
    : value;
}
