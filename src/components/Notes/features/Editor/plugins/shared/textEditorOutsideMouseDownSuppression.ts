export function createTextEditorOutsideMouseDownSuppression() {
  let isSuppressed = false;
  let suppressionTimer: number | null = null;

  const clear = () => {
    if (suppressionTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(suppressionTimer);
    }
    isSuppressed = false;
    suppressionTimer = null;
  };

  const schedule = () => {
    isSuppressed = true;
    if (suppressionTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(suppressionTimer);
    }

    if (typeof window === 'undefined') {
      return;
    }

    suppressionTimer = window.setTimeout(() => {
      isSuppressed = false;
      suppressionTimer = null;
    }, 0);
  };

  return {
    clear,
    isSuppressed: () => isSuppressed,
    schedule,
  };
}
