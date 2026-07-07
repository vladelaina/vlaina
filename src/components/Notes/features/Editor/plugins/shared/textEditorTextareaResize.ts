import {
  resizeTextEditorPopupTextareaToContent,
  TEXT_EDITOR_POPUP_CARD_SELECTOR,
} from './textEditorPopupDom';

export function createTextEditorTextareaResizeController(args: {
  getEditorElement: () => HTMLElement | null;
  getTextarea: () => HTMLTextAreaElement | null;
  constrainToViewport: boolean;
}) {
  let textareaResizeFrame: number | null = null;

  const resizeToContent = () => {
    const editorElement = args.getEditorElement();
    const textarea = args.getTextarea();
    if (!editorElement || !textarea) {
      return;
    }

    const card = editorElement.querySelector(TEXT_EDITOR_POPUP_CARD_SELECTOR);
    if (card instanceof HTMLElement) {
      resizeTextEditorPopupTextareaToContent({
        card,
        textarea,
        constrainToViewport: args.constrainToViewport,
      });
    }
  };

  const clear = () => {
    if (textareaResizeFrame !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(textareaResizeFrame);
    }
    textareaResizeFrame = null;
  };

  const schedule = () => {
    if (typeof window === 'undefined') {
      resizeToContent();
      return;
    }

    if (textareaResizeFrame !== null) {
      return;
    }

    textareaResizeFrame = window.requestAnimationFrame(() => {
      textareaResizeFrame = null;
      resizeToContent();
    });
  };

  return { clear, resizeToContent, schedule };
}
