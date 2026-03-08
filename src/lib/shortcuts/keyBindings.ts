interface ShortcutKeyboardEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export function isToggleShortcutsBinding(event: ShortcutKeyboardEventLike): boolean {
  const isMod = event.ctrlKey || event.metaKey;
  return isMod && !event.altKey && !event.shiftKey && event.key === '/';
}
