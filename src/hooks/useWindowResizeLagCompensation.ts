import { useEffect } from 'react';
import { isNativeWindows } from '@/lib/desktop/platform';
import { isElectronRuntime } from '@/lib/electron/bridge';

const COMPENSATION_CSS_VARIABLE = '--vlaina-window-resize-compensation-x';
const MAX_COMPENSATION_PX = 4096;

export function calculateWindowResizeCompensationPx({
  baselineGap,
  innerWidth,
  outerWidth,
}: {
  baselineGap: number;
  innerWidth: number;
  outerWidth: number;
}) {
  if (!Number.isFinite(baselineGap) || !Number.isFinite(innerWidth) || !Number.isFinite(outerWidth)) {
    return 0;
  }

  const compensation = Math.round(outerWidth - innerWidth - baselineGap);
  if (Math.abs(compensation) < 1) {
    return 0;
  }
  return Math.max(-MAX_COMPENSATION_PX, Math.min(MAX_COMPENSATION_PX, compensation));
}

export function useWindowResizeLagCompensation() {
  useEffect(() => {
    if (!isElectronRuntime() || !isNativeWindows()) {
      return undefined;
    }

    const root = document.documentElement;
    const baselineGap = window.outerWidth - window.innerWidth;
    let frameId = 0;
    let lastCompensation = Number.NaN;

    const applyCompensation = () => {
      const compensation = calculateWindowResizeCompensationPx({
        baselineGap,
        innerWidth: window.innerWidth,
        outerWidth: window.outerWidth,
      });

      if (compensation !== lastCompensation) {
        lastCompensation = compensation;
        root.style.setProperty(COMPENSATION_CSS_VARIABLE, `${compensation}px`);
      }
    };

    const applyCompensationFrame = () => {
      applyCompensation();
      frameId = window.requestAnimationFrame(applyCompensationFrame);
    };

    applyCompensation();
    window.addEventListener('resize', applyCompensation, true);
    window.visualViewport?.addEventListener('resize', applyCompensation, true);
    window.visualViewport?.addEventListener('scroll', applyCompensation, true);
    frameId = window.requestAnimationFrame(applyCompensationFrame);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', applyCompensation, true);
      window.visualViewport?.removeEventListener('resize', applyCompensation, true);
      window.visualViewport?.removeEventListener('scroll', applyCompensation, true);
      root.style.removeProperty(COMPENSATION_CSS_VARIABLE);
    };
  }, []);
}
