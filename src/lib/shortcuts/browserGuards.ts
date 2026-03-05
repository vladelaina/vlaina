export function shouldBlockBrowserReservedShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  const hasModifier = event.ctrlKey || event.metaKey;
  return hasModifier && !event.shiftKey && !event.altKey && key === 'j';
}
