import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';

const NATIVE_DRAG_ALLOW_SELECTOR = '[data-allow-editor-native-drag="true"]';

function selectionRangeIntersectsTarget(selection: Selection, target: Node): boolean {
  for (let index = 0; index < selection.rangeCount; index += 1) {
    try {
      if (selection.getRangeAt(index).intersectsNode(target)) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

export function isNativeDragFromCurrentEditorSelection(
  editorDom: HTMLElement,
  target: Node,
  selection: Selection | null | undefined,
): boolean {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  if (!editorDom.contains(selection.anchorNode) || !editorDom.contains(selection.focusNode)) return false;
  return selectionRangeIntersectsTarget(selection, target);
}

export function shouldSuppressEditorNativeDragStart(
  editorDom: HTMLElement,
  target: EventTarget | null,
  selection: Selection | null | undefined = typeof window === 'undefined' ? null : window.getSelection(),
): boolean {
  if (!(target instanceof Node) || !editorDom.contains(target)) return false;
  if (target instanceof Element && target.closest(NATIVE_DRAG_ALLOW_SELECTOR)) return false;
  if (target.parentElement?.closest(NATIVE_DRAG_ALLOW_SELECTOR)) return false;
  if (isNativeDragFromCurrentEditorSelection(editorDom, target, selection)) return false;
  return true;
}

export const nativeDragGuardPlugin = $prose(() => new Plugin({
  props: {
    handleDOMEvents: {
      dragstart(view, event) {
        if (!shouldSuppressEditorNativeDragStart(view.dom, event.target, view.dom.ownerDocument.getSelection())) return false;

        event.preventDefault();
        event.stopPropagation();
        return true;
      },
    },
  },
}));
