import type { ShortcutConfig, ShortcutKeyboardEventLike } from './types';
import { normalizeShortcutEventKey, normalizeShortcutKeyToken } from './normalize';

export function getKeysFromEvent(e: ShortcutKeyboardEventLike): string[] {
  const keys: string[] = [];
  if (e.ctrlKey || e.metaKey) keys.push('ctrl');
  if (e.shiftKey) keys.push('shift');
  if (e.altKey) keys.push('alt');
  
  if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    keys.push(normalizeShortcutEventKey(e));
  }
  
  return keys;
}

export function matchShortcut(pressedKeys: string[], shortcut: ShortcutConfig): boolean {
  if (!shortcut.keys || shortcut.keys.length === 0) return false;
  
  const expectedKeys = shortcut.keys.map(normalizeShortcutKeyToken);
  
  return pressedKeys.length === expectedKeys.length &&
    expectedKeys.every(k => pressedKeys.includes(k));
}

export function formatShortcut(keys: string[]): string {
  return keys.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join('+');
}
