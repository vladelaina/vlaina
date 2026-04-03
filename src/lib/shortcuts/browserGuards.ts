export function shouldBlockBrowserReservedShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  const hasModifier = event.ctrlKey || event.metaKey;

  if (!hasModifier || event.shiftKey || event.altKey) {
    return false;
  }

  return key === 'j' || key === 'p';
}
