import { useEffect } from 'react';
import { focusComposerInput, insertTextIntoComposer } from '@/lib/ui/composerFocusRegistry';

export function useEmbeddedComposerInsert(args: {
  consumePendingComposerInsert: (id: number) => void;
  isEmbedded: boolean;
  pendingComposerInsert: { id: number; text: string } | null;
}) {
  const { consumePendingComposerInsert, isEmbedded, pendingComposerInsert } = args;

  useEffect(() => {
    if (!isEmbedded || !pendingComposerInsert) {
      return;
    }

    let frameId = 0;
    let attempts = 0;
    let cancelled = false;

    const tryInsert = () => {
      if (cancelled) {
        return;
      }

      if (insertTextIntoComposer(pendingComposerInsert.text)) {
        focusComposerInput();
        consumePendingComposerInsert(pendingComposerInsert.id);
        return;
      }

      attempts += 1;
      if (attempts >= 24) {
        consumePendingComposerInsert(pendingComposerInsert.id);
        return;
      }

      frameId = requestAnimationFrame(tryInsert);
    };

    tryInsert();

    return () => {
      cancelled = true;
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [consumePendingComposerInsert, isEmbedded, pendingComposerInsert]);
}
