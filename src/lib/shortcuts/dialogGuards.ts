export function isEventInsideDialog(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return !!target.closest('[role="dialog"], [aria-modal="true"]');
}
