import { getKeysFromEvent, matchShortcut } from './matcher';
import { getShortcutKeys } from './storage';
import type { ShortcutKeyboardEventLike } from './types';

export function isToggleShortcutsBinding(event: ShortcutKeyboardEventLike): boolean {
  const isMod = event.ctrlKey || event.metaKey;
  return isMod && !event.altKey && !event.shiftKey && event.key === '/';
}

export function matchesShortcutBinding(event: ShortcutKeyboardEventLike, id: string): boolean {
  const keys = getShortcutKeys(id);
  if (!keys || keys.length === 0) {
    return false;
  }

  return matchShortcut(getKeysFromEvent(event), {
    id,
    keys,
    description: id,
  });
}
