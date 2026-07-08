export function isEventInsideDialog(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return !!target.closest('[role="dialog"], [aria-modal="true"]');
}

export function isEventInsideNotesChatSurface(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return !!target.closest('[data-notes-chat-panel="true"], [data-notes-chat-floating="true"]');
}
