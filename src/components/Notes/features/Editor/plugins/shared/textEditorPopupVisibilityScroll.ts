export function createTextEditorPopupVisibilityScrollScheduler(args: {
  shouldScroll: boolean;
  scrollIntoView: () => void;
}) {
  let popupVisibilityFrame: number | null = null;

  const clear = () => {
    if (popupVisibilityFrame !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(popupVisibilityFrame);
    }
    popupVisibilityFrame = null;
  };

  const schedule = () => {
    if (!args.shouldScroll) {
      return;
    }

    if (typeof window === 'undefined') {
      args.scrollIntoView();
      return;
    }

    if (popupVisibilityFrame !== null) {
      return;
    }

    popupVisibilityFrame = window.requestAnimationFrame(() => {
      popupVisibilityFrame = null;
      args.scrollIntoView();
    });
  };

  return { clear, schedule };
}
