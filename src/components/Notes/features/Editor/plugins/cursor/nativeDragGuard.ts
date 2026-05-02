import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';

const NATIVE_DRAG_ALLOW_SELECTOR = '[data-allow-editor-native-drag="true"]';

export function shouldSuppressEditorNativeDragStart(
  editorDom: HTMLElement,
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Node) || !editorDom.contains(target)) return false;
  if (target instanceof Element && target.closest(NATIVE_DRAG_ALLOW_SELECTOR)) return false;
  if (target.parentElement?.closest(NATIVE_DRAG_ALLOW_SELECTOR)) return false;
  return true;
}

export const nativeDragGuardPlugin = $prose(() => new Plugin({
  props: {
    handleDOMEvents: {
      dragstart(view, event) {
        if (!shouldSuppressEditorNativeDragStart(view.dom, event.target)) return false;

        event.preventDefault();
        event.stopPropagation();
        return true;
      },
    },
  },
}));
