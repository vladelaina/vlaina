import type { ShortcutKeyboardEventLike } from './types';

const CODE_TO_SHORTCUT_KEY: Record<string, string> = {
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
};

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
};

export function normalizeShortcutEventKey(event: ShortcutKeyboardEventLike): string {
  return (CODE_TO_SHORTCUT_KEY[event.code ?? ''] ?? event.key).toLowerCase();
}

export function normalizeShortcutKeyToken(key: string): string {
  const normalized = key.trim().toLowerCase();
  return KEY_ALIASES[normalized] ?? normalized;
}

export function formatRecordedShortcutKey(event: ShortcutKeyboardEventLike): string {
  return CODE_TO_SHORTCUT_KEY[event.code ?? ''] ?? (event.key.length === 1 ? event.key.toUpperCase() : event.key);
}
