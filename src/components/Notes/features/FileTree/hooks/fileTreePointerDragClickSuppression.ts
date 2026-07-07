import { themeUiFeedbackTokens } from '@/styles/themeTokens';
import type { FileTreePointerDragSession } from './fileTreePointerDragTypes';

let pendingClickSuppressionCleanup: (() => void) | null = null;

export function suppressNextFileTreePointerClick(session: FileTreePointerDragSession | null) {
  pendingClickSuppressionCleanup?.();
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  let timeoutId: number | null = null;
  const handleClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    cleanup();
  };

  const cleanup = () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', handleClick, true);
    }
    if (timeoutId != null) {
      globalThis.clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (session?.suppressClickTimeout != null) {
      globalThis.clearTimeout(session.suppressClickTimeout);
      session.suppressClickTimeout = null;
    }
    if (pendingClickSuppressionCleanup === cleanup) {
      pendingClickSuppressionCleanup = null;
    }
  };

  document.addEventListener('click', handleClick, true);
  timeoutId = window.setTimeout(
    cleanup,
    themeUiFeedbackTokens.fileTreeClickSuppressionCleanupDelayMs
  );
  pendingClickSuppressionCleanup = cleanup;

  if (session) {
    session.suppressClickTimeout = timeoutId;
  }
}
