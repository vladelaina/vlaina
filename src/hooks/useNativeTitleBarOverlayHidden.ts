import { useEffect } from 'react';
import { desktopWindow } from '@/lib/desktop/window';

let hiddenRequestCount = 0;

export function useNativeTitleBarOverlayHidden(hidden: boolean) {
  useEffect(() => {
    if (!hidden) return;

    hiddenRequestCount += 1;
    if (hiddenRequestCount === 1) {
      void desktopWindow.setTitleBarOverlayVisible(false);
    }

    return () => {
      hiddenRequestCount = Math.max(0, hiddenRequestCount - 1);
      if (hiddenRequestCount === 0) {
        void desktopWindow.setTitleBarOverlayVisible(true);
      }
    };
  }, [hidden]);
}
