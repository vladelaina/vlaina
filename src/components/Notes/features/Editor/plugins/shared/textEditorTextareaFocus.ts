export function createTextEditorTextareaFocusController(getTextarea: () => HTMLTextAreaElement | null) {
  let focusTextareaTimer: number | null = null;

  const focusNow = () => {
    const nextTextarea = getTextarea();
    if (!nextTextarea) {
      return;
    }

    try {
      nextTextarea.focus({ preventScroll: true });
    } catch {
      nextTextarea.focus();
    }
    const length = nextTextarea.value.length;
    nextTextarea.setSelectionRange(length, length);
  };

  const clear = () => {
    if (focusTextareaTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(focusTextareaTimer);
    }
    focusTextareaTimer = null;
  };

  const focusAtEnd = () => {
    clear();

    if (typeof window === 'undefined') {
      focusNow();
      return;
    }

    focusNow();
    focusTextareaTimer = window.setTimeout(() => {
      focusTextareaTimer = null;
      focusNow();
    }, 0);
  };

  return { clear, focusAtEnd };
}
