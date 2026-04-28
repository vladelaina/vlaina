import { useCallback, useEffect, useRef } from 'react';
import { focusComposerInput } from '@/lib/ui/composerFocusRegistry';

export function useNotesChatComposerFocus(setChatPanelCollapsed: (collapsed: boolean) => void) {
  const chatComposerFocusFrameRef = useRef<number | null>(null);

  const focusNotesChatComposer = useCallback(() => {
    if (chatComposerFocusFrameRef.current !== null) {
      cancelAnimationFrame(chatComposerFocusFrameRef.current);
      chatComposerFocusFrameRef.current = null;
    }

    setChatPanelCollapsed(false);

    let attempts = 0;
    const tryFocus = () => {
      if (focusComposerInput()) {
        chatComposerFocusFrameRef.current = null;
        return;
      }

      attempts += 1;
      if (attempts >= 24) {
        chatComposerFocusFrameRef.current = null;
        return;
      }

      chatComposerFocusFrameRef.current = requestAnimationFrame(tryFocus);
    };

    chatComposerFocusFrameRef.current = requestAnimationFrame(tryFocus);
  }, [setChatPanelCollapsed]);

  useEffect(() => {
    return () => {
      if (chatComposerFocusFrameRef.current !== null) {
        cancelAnimationFrame(chatComposerFocusFrameRef.current);
      }
    };
  }, []);

  return focusNotesChatComposer;
}
