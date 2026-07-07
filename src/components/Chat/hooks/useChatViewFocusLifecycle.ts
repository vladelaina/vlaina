import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { focusComposerInput } from '@/lib/ui/composerFocusRegistry';

export function useChatViewFocusLifecycle(args: {
  active: boolean;
  currentSessionId: string | null;
  isEmbedded: boolean;
  loaded: boolean;
  onPrimaryContentReady?: () => void;
  onStartupReady?: () => void;
  setFocusInputTrigger: Dispatch<SetStateAction<number>>;
}) {
  const {
    active,
    currentSessionId,
    isEmbedded,
    loaded,
    onPrimaryContentReady,
    onStartupReady,
    setFocusInputTrigger,
  } = args;
  const wasActiveRef = useRef(active);

  useEffect(() => {
    if (!active) return;
    onStartupReady?.();
    if (loaded) {
      onPrimaryContentReady?.();
    }
  }, [active, loaded, onPrimaryContentReady, onStartupReady]);

  useEffect(() => {
      setFocusInputTrigger(n => n + 1);
  }, [currentSessionId, setFocusInputTrigger]);

  useEffect(() => {
    if (isEmbedded || !active || wasActiveRef.current) {
      wasActiveRef.current = active;
      return;
    }

    wasActiveRef.current = active;
    let secondFrameId = 0;
    const firstFrameId = requestAnimationFrame(() => {
      if (focusComposerInput()) {
        return;
      }
      setFocusInputTrigger(n => n + 1);
      secondFrameId = requestAnimationFrame(() => {
        focusComposerInput();
      });
    });

    return () => {
      cancelAnimationFrame(firstFrameId);
      if (secondFrameId) {
        cancelAnimationFrame(secondFrameId);
      }
    };
  }, [active, isEmbedded, setFocusInputTrigger]);
}
