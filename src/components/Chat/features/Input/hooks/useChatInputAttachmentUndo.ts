import { useEffect, type RefObject } from 'react';

interface UndoShortcutEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}

interface UseChatInputAttachmentUndoOptions {
  active: boolean;
  composerRootRef: RefObject<HTMLDivElement | null>;
  scheduleComposerFocus: (position?: number) => void;
  undoLastRemovedAttachment: () => boolean;
}

function isUndoShortcut(event: UndoShortcutEvent): boolean {
  return (
    event.key.toLowerCase() === 'z' &&
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey
  );
}

function isAttachmentUndoTarget(
  target: EventTarget | null,
  composerRoot: HTMLElement | null,
  ownerDocument: Document,
): boolean {
  if (!target || target === ownerDocument || target === ownerDocument.defaultView) {
    return true;
  }
  if (target === ownerDocument.body || target === ownerDocument.documentElement) {
    return true;
  }
  return target instanceof Node && !!composerRoot?.contains(target);
}

export function useChatInputAttachmentUndo({
  active,
  composerRootRef,
  scheduleComposerFocus,
  undoLastRemovedAttachment,
}: UseChatInputAttachmentUndoOptions) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const handleWindowUndo = (event: globalThis.KeyboardEvent) => {
      if (event.isComposing) {
        return;
      }

      if (
        !isUndoShortcut(event) ||
        !isAttachmentUndoTarget(event.target, composerRootRef.current, document)
      ) {
        return;
      }

      if (!undoLastRemovedAttachment()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      scheduleComposerFocus();
    };

    window.addEventListener('keydown', handleWindowUndo, true);
    return () => window.removeEventListener('keydown', handleWindowUndo, true);
  }, [active, composerRootRef, scheduleComposerFocus, undoLastRemovedAttachment]);
}
