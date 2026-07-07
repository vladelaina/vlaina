import { useEffect, useRef } from 'react';

export function useWhiteboardReady(onStartupReady?: () => void, onPrimaryContentReady?: () => void) {
  const readyRef = useRef(false);

  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onStartupReady?.();
    onPrimaryContentReady?.();
  }, [onPrimaryContentReady, onStartupReady]);
}
