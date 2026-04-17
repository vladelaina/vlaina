export interface ScrollRestoreSessionOptions {
  notePath: string;
  targetScrollTop: number;
  tolerancePx?: number;
  getActivePath: () => string | null;
  getSessionPath: () => string | null;
  readScrollTop: () => number;
  writeScrollTop: (top: number) => void;
  onApply?: (reason: string) => void;
  onFinish: () => void;
  onStop?: () => void;
}

export interface ScrollRestoreSession {
  isActive: () => boolean;
  restore: (reason: string, currentScrollTop?: number) => boolean;
  finish: () => boolean;
  stop: () => void;
}

const DEFAULT_TOLERANCE_PX = 1;

export function createScrollRestoreSession(
  options: ScrollRestoreSessionOptions,
): ScrollRestoreSession {
  const tolerancePx = options.tolerancePx ?? DEFAULT_TOLERANCE_PX;
  let active = true;

  const isCurrentSession = () =>
    active
    && options.getActivePath() === options.notePath
    && options.getSessionPath() === options.notePath;

  const stop = () => {
    if (!active) {
      return;
    }

    active = false;
    options.onStop?.();
  };

  const restore = (reason: string, currentScrollTop?: number) => {
    if (!isCurrentSession()) {
      return false;
    }

    const resolvedScrollTop = currentScrollTop ?? options.readScrollTop();
    if (Math.abs(resolvedScrollTop - options.targetScrollTop) <= tolerancePx) {
      return true;
    }

    options.writeScrollTop(options.targetScrollTop);
    options.onApply?.(reason);
    return false;
  };

  const finish = () => {
    if (!isCurrentSession()) {
      return false;
    }

    stop();
    options.onFinish();
    return true;
  };

  return {
    isActive: () => active,
    restore,
    finish,
    stop,
  };
}
