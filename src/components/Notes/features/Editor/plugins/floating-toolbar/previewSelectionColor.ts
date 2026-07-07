import type { EditorView } from '@milkdown/kit/prose/view';
import {
  BG_COLOR_MARK_BG_VAR,
  BG_COLOR_MARK_SELECTOR,
  INLINE_BACKGROUND_PADDING,
  INLINE_BACKGROUND_RADIUS,
  INLINE_BACKGROUND_SHADOW,
  TEXT_COLOR_MARK_SELECTOR,
  TEXT_SELECTION_OVERLAY_CLASS,
  TOOLBAR_COLOR_PREVIEW_ATTRIBUTE,
  TOOLBAR_COLOR_PREVIEW_REMOVES_COUNTERPART_ATTRIBUTE,
  TOOLBAR_PREVIEW_BG_COLOR_VAR,
  TOOLBAR_PREVIEW_DEFAULT_TEXT_COLOR,
  TOOLBAR_PREVIEW_SURFACE_BG,
  TOOLBAR_PREVIEW_TEXT_COLOR_VAR,
  TOOLBAR_SELECTION_HIDDEN_PREVIEW_CLASS,
} from './previewStyleConstants';
import { clearPreviewOverlay } from './previewAppliedRenderer';
import {
  clearNativeSelectionForPreviewFrames,
  showTextSelectionOverlayForPreview,
} from './previewNativeSelection';
import {
  getSelectionColorPreviewSignature,
  hasSameSelectionColorPreviewSignature,
} from './previewSelectionSignature';
import { previewStyleState } from './previewStyleState';

function hasMatchingSelectionColorPreview(view: EditorView, key: string): boolean {
  const selectionColorPreview = previewStyleState.selectionColorPreview;
  if (
    !selectionColorPreview ||
    selectionColorPreview.viewDom !== view.dom ||
    selectionColorPreview.key !== key ||
    !view.state.doc.eq(selectionColorPreview.originalDoc) ||
    !hasSameSelectionColorPreviewSignature(
      getSelectionColorPreviewSignature(view),
      selectionColorPreview.selection
    )
  ) {
    return false;
  }

  return selectionColorPreview.styleMutations.every(({ node }) => node.isConnected);
}

export function refreshMatchingSelectionColorPreview(view: EditorView, key: string): boolean {
  if (!hasMatchingSelectionColorPreview(view, key)) {
    return false;
  }

  if (view.dom instanceof HTMLElement) {
    clearNativeSelectionForPreviewFrames(view.dom);
  }

  return true;
}

export function clearSelectionColorPreview(): boolean {
  const selectionColorPreview = previewStyleState.selectionColorPreview;
  if (!selectionColorPreview) {
    return false;
  }

  const { viewDom } = selectionColorPreview;
  if (viewDom.isConnected) {
    viewDom.classList.remove(TOOLBAR_SELECTION_HIDDEN_PREVIEW_CLASS);
    viewDom.removeAttribute(TOOLBAR_COLOR_PREVIEW_ATTRIBUTE);
    viewDom.removeAttribute(TOOLBAR_COLOR_PREVIEW_REMOVES_COUNTERPART_ATTRIBUTE);
    viewDom.style.removeProperty(TOOLBAR_PREVIEW_TEXT_COLOR_VAR);
    viewDom.style.removeProperty(TOOLBAR_PREVIEW_BG_COLOR_VAR);
  }
  selectionColorPreview.styleMutations.forEach(({ cssText, node }) => {
    if (node.isConnected) {
      node.style.cssText = cssText;
    }
  });
  previewStyleState.selectionColorPreview = null;
  return true;
}

function getTextSelectionOverlayElements(viewDom: HTMLElement): HTMLElement[] {
  const overlays = viewDom.getElementsByClassName(TEXT_SELECTION_OVERLAY_CLASS);
  const elements: HTMLElement[] = [];
  for (let index = 0; index < overlays.length; index += 1) {
    const overlay = overlays.item(index);
    if (overlay instanceof HTMLElement) {
      elements.push(overlay);
    }
  }

  return elements;
}

function recordStyleMutation(
  mutations: Array<{ cssText: string; node: HTMLElement }>,
  node: HTMLElement
): void {
  if (mutations.some((mutation) => mutation.node === node)) {
    return;
  }

  mutations.push({
    cssText: node.style.cssText,
    node,
  });
}

function collectSelectedMarkElements(
  viewDom: HTMLElement,
  overlay: HTMLElement,
  selector: string
): HTMLElement[] {
  const selectedMarks = new Set<HTMLElement>();
  if (overlay.matches(selector)) {
    selectedMarks.add(overlay);
  }

  const closestMark = overlay.closest(selector);
  if (
    closestMark instanceof HTMLElement &&
    viewDom.contains(closestMark)
  ) {
    selectedMarks.add(closestMark);
  }

  overlay.querySelectorAll<HTMLElement>(selector).forEach((mark) => {
    selectedMarks.add(mark);
  });

  return Array.from(selectedMarks);
}

function hasSelectedMarkElement(
  viewDom: HTMLElement,
  overlay: HTMLElement,
  selector: string
): boolean {
  if (overlay.matches(selector)) {
    return true;
  }

  const closestMark = overlay.closest(selector);
  if (closestMark instanceof HTMLElement && viewDom.contains(closestMark)) {
    return true;
  }

  return overlay.querySelector(selector) !== null;
}

function collectSelectedDescendantMarkElements(
  overlay: HTMLElement,
  selector: string
): HTMLElement[] {
  return Array.from(overlay.querySelectorAll<HTMLElement>(selector));
}

function applySelectionColorPreviewInlineStyles(
  viewDom: HTMLElement,
  type: 'bg' | 'idle' | 'text',
  color: string | null
): {
  removesCounterpart: boolean;
  styleMutations: Array<{ cssText: string; node: HTMLElement }>;
} {
  const mutations: Array<{ cssText: string; node: HTMLElement }> = [];
  let removesCounterpart = false;
  const overlays = getTextSelectionOverlayElements(viewDom);

  overlays.forEach((overlay) => {
    if (type === 'text' && color) {
      if (!hasSelectedMarkElement(viewDom, overlay, BG_COLOR_MARK_SELECTOR)) {
        return;
      }

      removesCounterpart = true;
      recordStyleMutation(mutations, overlay);
      overlay.style.setProperty('background', TOOLBAR_PREVIEW_SURFACE_BG, 'important');
      overlay.style.setProperty('background-color', TOOLBAR_PREVIEW_SURFACE_BG, 'important');
      overlay.style.setProperty('border-radius', INLINE_BACKGROUND_RADIUS, 'important');
      overlay.style.setProperty('box-shadow', INLINE_BACKGROUND_SHADOW, 'important');
      overlay.style.setProperty('padding', INLINE_BACKGROUND_PADDING, 'important');
      collectSelectedDescendantMarkElements(overlay, BG_COLOR_MARK_SELECTOR).forEach((mark) => {
        recordStyleMutation(mutations, mark);
        mark.style.setProperty('background', 'transparent', 'important');
        mark.style.setProperty('background-color', 'transparent', 'important');
        mark.style.setProperty('box-shadow', 'none', 'important');
      });
      return;
    }

    if (type === 'bg' && color) {
      const selectedBgMarks = collectSelectedMarkElements(viewDom, overlay, BG_COLOR_MARK_SELECTOR);
      if (selectedBgMarks.length > 0) {
        recordStyleMutation(mutations, overlay);
        overlay.style.setProperty('background', 'transparent', 'important');
        overlay.style.setProperty('background-color', 'transparent', 'important');
        overlay.style.setProperty('box-shadow', 'none', 'important');
        overlay.style.setProperty('padding', INLINE_BACKGROUND_PADDING, 'important');
        selectedBgMarks.forEach((mark) => {
          recordStyleMutation(mutations, mark);
          mark.style.setProperty(BG_COLOR_MARK_BG_VAR, color);
          mark.style.setProperty('background-color', `var(${BG_COLOR_MARK_BG_VAR})`, 'important');
          mark.style.setProperty('box-shadow', INLINE_BACKGROUND_SHADOW, 'important');
          mark.style.setProperty('padding', INLINE_BACKGROUND_PADDING);
        });
      }

      const selectedTextMarks = collectSelectedMarkElements(viewDom, overlay, TEXT_COLOR_MARK_SELECTOR);
      if (selectedTextMarks.length === 0) {
        return;
      }

      removesCounterpart = true;
      recordStyleMutation(mutations, overlay);
      overlay.style.setProperty('color', TOOLBAR_PREVIEW_DEFAULT_TEXT_COLOR, 'important');
      overlay.style.setProperty('-webkit-text-fill-color', TOOLBAR_PREVIEW_DEFAULT_TEXT_COLOR, 'important');
      selectedTextMarks.forEach((mark) => {
        recordStyleMutation(mutations, mark);
        mark.style.setProperty('color', TOOLBAR_PREVIEW_DEFAULT_TEXT_COLOR, 'important');
        mark.style.setProperty('-webkit-text-fill-color', TOOLBAR_PREVIEW_DEFAULT_TEXT_COLOR, 'important');
      });
    }
  });

  return {
    removesCounterpart,
    styleMutations: mutations,
  };
}

export function renderSelectionColorPreview(
  view: EditorView,
  type: 'bg' | 'idle' | 'text',
  color: string | null,
  key: string
): boolean {
  if (!(view.dom instanceof HTMLElement)) {
    return false;
  }

  if (hasMatchingSelectionColorPreview(view, key)) {
    clearNativeSelectionForPreviewFrames(view.dom);
    return true;
  }

  clearPreviewOverlay();
  clearSelectionColorPreview();
  showTextSelectionOverlayForPreview(view);

  view.dom.classList.add(TOOLBAR_SELECTION_HIDDEN_PREVIEW_CLASS);
  view.dom.setAttribute(TOOLBAR_COLOR_PREVIEW_ATTRIBUTE, type);
  if (type === 'text' && color) {
    view.dom.style.setProperty(TOOLBAR_PREVIEW_TEXT_COLOR_VAR, color);
  }
  if (type === 'bg' && color) {
    view.dom.style.setProperty(TOOLBAR_PREVIEW_BG_COLOR_VAR, color);
  }
  const previewStyles = applySelectionColorPreviewInlineStyles(view.dom, type, color);
  if (previewStyles.removesCounterpart) {
    view.dom.setAttribute(TOOLBAR_COLOR_PREVIEW_REMOVES_COUNTERPART_ATTRIBUTE, 'true');
  }

  previewStyleState.selectionColorPreview = {
    key,
    originalDoc: view.state.doc,
    selection: getSelectionColorPreviewSignature(view),
    styleMutations: previewStyles.styleMutations,
    viewDom: view.dom,
  };
  clearNativeSelectionForPreviewFrames(view.dom);
  return true;
}
