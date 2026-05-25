export function hasSlashMenuNavigationModifier(event: KeyboardEvent): boolean {
  return event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;
}

export function isPlainSlashMenuNavigationKey(event: KeyboardEvent): boolean {
  return (
    (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
    !hasSlashMenuNavigationModifier(event) &&
    !event.isComposing
  );
}
