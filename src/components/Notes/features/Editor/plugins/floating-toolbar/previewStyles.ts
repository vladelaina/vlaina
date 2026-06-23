import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  cleanupAppliedPreviewDocument,
  createAppliedPreviewState,
  renderAppliedPreviewDocument,
} from './appliedPreviewState';
import { themeStyleResetTokens } from '@/styles/themeTokens';
import {
  convertBlockType,
  setBgColor,
  setLink,
  setTextAlignment,
  setTextColor,
  toggleMark,
} from './commands';
import type { BlockType, TextAlignment } from './types';
import { markEditorUserInput } from '../shared/userInputEvents';
import { showTextSelectionOverlayForTransaction } from '../selection/textSelectionOverlayPlugin';

const FORMAT_MARKS: Record<string, string> = {
  bold: 'strong',
  italic: 'emphasis',
  underline: 'underline',
  strike: 'strike_through',
  code: 'inlineCode',
  highlight: 'highlight',
};

// Large notes should not clone the full editor DOM for hover-only previews.
const MAX_APPLIED_PREVIEW_DOC_SIZE = 256 * 1024;
const MAX_APPLIED_PREVIEW_DOM_ELEMENTS = 2_500;
const TOOLBAR_SELECTION_HIDDEN_PREVIEW_CLASS = 'toolbar-selection-hidden-preview';
const TOOLBAR_COLOR_PREVIEW_ATTRIBUTE = 'data-toolbar-color-preview';
const TOOLBAR_COLOR_PREVIEW_REMOVES_COUNTERPART_ATTRIBUTE = 'data-toolbar-color-preview-removes-counterpart';
const TOOLBAR_PREVIEW_TEXT_COLOR_VAR = '--vlaina-toolbar-preview-text-color';
const TOOLBAR_PREVIEW_BG_COLOR_VAR = '--vlaina-toolbar-preview-bg-color';
const TEXT_SELECTION_OVERLAY_CLASS = 'editor-text-selection-overlay';
const POINTER_NATIVE_SELECTION_CLASS = 'editor-pointer-native-selection';
const BG_COLOR_MARK_SELECTOR = 'mark[data-bg-color], span[data-bg-color]';
const TEXT_COLOR_MARK_SELECTOR = 'span[data-text-color]';
const TOOLBAR_PREVIEW_DEFAULT_TEXT_COLOR = 'var(--vlaina-sidebar-notes-text, var(--vlaina-text-primary, currentColor))';
const BG_COLOR_MARK_BG_VAR = '--vlaina-bg-color-mark-bg';
const INLINE_BACKGROUND_PADDING = 'var(--vlaina-editor-inline-background-padding, var(--vlaina-space-0))';
const INLINE_BACKGROUND_RADIUS = 'var(--vlaina-editor-inline-background-radius, var(--vlaina-radius-0))';
const INLINE_BACKGROUND_SHADOW = 'var(--vlaina-editor-inline-background-shadow, none)';
const TOOLBAR_PREVIEW_SURFACE_BG = 'var(--vlaina-bg-primary)';
const NOTE_SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';

type SelectionColorPreviewSignature = {
  empty: boolean;
  from: number;
  to: number;
} | null;

type PreviewScrollSnapshot = {
  element: HTMLElement;
  releaseGuard: () => void;
  scrollLeft: number;
  scrollTop: number;
};

type PreviewScrollGuard = {
  count: number;
  originalOverflowAnchor: string;
  originalOverflowAnchorPriority: string;
};

let previewOverlay: {
  key: string;
  node: HTMLElement;
  originalDoc: EditorState['doc'];
  originalViewDisplay: string;
  previewState: EditorState;
  viewDom: HTMLElement;
} | null = null;
const previewScrollGuards = new WeakMap<HTMLElement, PreviewScrollGuard>();
let selectionColorPreview: {
  key: string;
  originalDoc: EditorState['doc'];
  selection: SelectionColorPreviewSignature;
  styleMutations: Array<{
    cssText: string;
    node: HTMLElement;
  }>;
  viewDom: HTMLElement;
} | null = null;

export function hasFormatPreview(action: string): boolean {
  return action in FORMAT_MARKS || action === 'link';
}

export function hasBlockPreview(blockType: BlockType): boolean {
  return (
    blockType === 'paragraph' ||
    blockType === 'heading1' ||
    blockType === 'heading2' ||
    blockType === 'heading3' ||
    blockType === 'heading4' ||
    blockType === 'heading5' ||
    blockType === 'heading6' ||
    blockType === 'bulletList' ||
    blockType === 'orderedList' ||
    blockType === 'taskList' ||
    blockType === 'blockquote' ||
    blockType === 'codeBlock'
  );
}

export function hasActiveAppliedPreview(view: EditorView): boolean {
  return Boolean(
    (previewOverlay && previewOverlay.viewDom === view.dom) ||
    (selectionColorPreview && selectionColorPreview.viewDom === view.dom)
  );
}

function hasMatchingPreview(view: EditorView, key: string): boolean {
  return Boolean(
    previewOverlay &&
    previewOverlay.viewDom === view.dom &&
    previewOverlay.key === key &&
    view.state.doc.eq(previewOverlay.originalDoc)
  );
}

function getSelectionColorPreviewSignature(view: EditorView): SelectionColorPreviewSignature {
  const selection = view.state.selection;
  if (
    !selection ||
    typeof selection.from !== 'number' ||
    typeof selection.to !== 'number' ||
    typeof selection.empty !== 'boolean'
  ) {
    return null;
  }

  return {
    empty: selection.empty,
    from: selection.from,
    to: selection.to,
  };
}

function hasSameSelectionColorPreviewSignature(
  current: SelectionColorPreviewSignature,
  previous: SelectionColorPreviewSignature
): boolean {
  if (!current || !previous) {
    return current === previous;
  }

  return (
    current.empty === previous.empty &&
    current.from === previous.from &&
    current.to === previous.to
  );
}

function hasMatchingSelectionColorPreview(view: EditorView, key: string): boolean {
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

function refreshMatchingSelectionColorPreview(view: EditorView, key: string): boolean {
  if (!hasMatchingSelectionColorPreview(view, key)) {
    return false;
  }

  if (view.dom instanceof HTMLElement) {
    clearNativeSelectionForPreviewFrames(view.dom);
  }

  return true;
}

function canRenderAppliedPreview(view: EditorView): boolean {
  const docSize = view.state.doc.content.size;
  if (typeof docSize !== 'number' || docSize > MAX_APPLIED_PREVIEW_DOC_SIZE) {
    return false;
  }

  if (!(view.dom instanceof HTMLElement)) {
    return true;
  }

  const walker = view.dom.ownerDocument.createTreeWalker(view.dom, 1);
  let scanned = 0;
  while (walker.nextNode()) {
    scanned += 1;
    if (scanned > MAX_APPLIED_PREVIEW_DOM_ELEMENTS) {
      return false;
    }
  }

  return true;
}

function capturePreviewScrollSnapshot(viewDom: HTMLElement): PreviewScrollSnapshot | null {
  const scrollRoot = viewDom.closest(NOTE_SCROLL_ROOT_SELECTOR);
  if (!(scrollRoot instanceof HTMLElement)) {
    return null;
  }

  const releaseGuard = retainPreviewScrollGuard(scrollRoot);
  return {
    element: scrollRoot,
    releaseGuard,
    scrollLeft: scrollRoot.scrollLeft,
    scrollTop: scrollRoot.scrollTop,
  };
}

function retainPreviewScrollGuard(element: HTMLElement): () => void {
  let guard = previewScrollGuards.get(element);
  if (!guard) {
    guard = {
      count: 0,
      originalOverflowAnchor: element.style.getPropertyValue('overflow-anchor'),
      originalOverflowAnchorPriority: element.style.getPropertyPriority('overflow-anchor'),
    };
    previewScrollGuards.set(element, guard);
    element.style.setProperty('overflow-anchor', 'none', 'important');
  }

  guard.count += 1;

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;

    const currentGuard = previewScrollGuards.get(element);
    if (!currentGuard) {
      return;
    }

    currentGuard.count -= 1;
    if (currentGuard.count > 0) {
      return;
    }

    previewScrollGuards.delete(element);
    if (currentGuard.originalOverflowAnchor) {
      element.style.setProperty(
        'overflow-anchor',
        currentGuard.originalOverflowAnchor,
        currentGuard.originalOverflowAnchorPriority
      );
    } else {
      element.style.removeProperty('overflow-anchor');
    }
  };
}

function restorePreviewScrollSnapshot(snapshot: PreviewScrollSnapshot | null): void {
  if (!snapshot) {
    return;
  }

  const restore = () => {
    if (!snapshot.element.isConnected) {
      return;
    }
    snapshot.element.scrollLeft = snapshot.scrollLeft;
    snapshot.element.scrollTop = snapshot.scrollTop;
  };
  const ownerWindow = snapshot.element.ownerDocument.defaultView;
  const releaseGuard = () => {
    restore();
    snapshot.releaseGuard();
  };

  restore();
  queueMicrotask(restore);
  ownerWindow?.requestAnimationFrame(() => {
    restore();
    ownerWindow.requestAnimationFrame(restore);
  });
  ownerWindow?.setTimeout(restore, 0);
  if (ownerWindow) {
    ownerWindow.setTimeout(releaseGuard, 50);
  } else {
    snapshot.releaseGuard();
  }
}

function createAppliedPreviewDom(
  view: EditorView,
  apply: (previewView: EditorView) => void
): { dom: HTMLElement; state: EditorState } | null {
  if (!(view.dom instanceof HTMLElement)) {
    return null;
  }

  const previewState = createAppliedPreviewState(view, apply);

  if (previewState.doc.eq(view.state.doc)) {
    return null;
  }

  // Toolbar previews must be generated by applying the real editor command to
  // a shadow state. Do not reintroduce hand-written DOM/CSS simulations here:
  // preview markup should match the eventual applied document, including node
  // views rehydrated by renderAppliedPreviewDocument.
  return {
    dom: renderAppliedPreviewDocument(previewState, view.dom, view.dom.ownerDocument, undefined, view),
    state: previewState,
  };
}

function clearNativeSelectionForPreview(view: EditorView): void {
  view.dom.ownerDocument.defaultView?.getSelection()?.removeAllRanges();
}

function clearNativeSelectionForPreviewFrames(viewDom: HTMLElement): void {
  const ownerWindow = viewDom.ownerDocument.defaultView;
  if (!ownerWindow) {
    return;
  }

  const clear = () => {
    if (
      viewDom.isConnected &&
      (
        selectionColorPreview?.viewDom === viewDom ||
        previewOverlay?.viewDom === viewDom
      )
    ) {
      ownerWindow.getSelection()?.removeAllRanges();
    }
  };

  clear();
  queueMicrotask(clear);
  ownerWindow.requestAnimationFrame(clear);
  ownerWindow.setTimeout(clear, 0);
  ownerWindow.setTimeout(clear, 50);
}

function showTextSelectionOverlayForPreview(view: EditorView): void {
  if (
    view.dom instanceof HTMLElement &&
    !view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS) &&
    view.dom.getElementsByClassName(TEXT_SELECTION_OVERLAY_CLASS).length > 0
  ) {
    return;
  }

  const selection = view.state.selection;
  const tr = view.state.tr;
  if (!selection || selection.empty || typeof tr?.setMeta !== 'function') {
    return;
  }

  view.dispatch(
    showTextSelectionOverlayForTransaction(tr)
      .setMeta('addToHistory', false)
  );
}

function renderAppliedPreview(
  view: EditorView,
  key: string,
  apply: (previewView: EditorView) => void
): boolean {
  if (!(view.dom instanceof HTMLElement) || !(view.dom.parentElement instanceof HTMLElement)) {
    void key;
    return false;
  }

  if (!canRenderAppliedPreview(view)) {
    clearPreviewOverlay();
    return false;
  }

  if (hasMatchingPreview(view, key)) {
    return true;
  }

  clearPreviewOverlay();

  const preview = createAppliedPreviewDom(view, apply);
  if (!preview) {
    return renderSelectionHiddenPreview(view, key);
  }

  const scrollSnapshot = capturePreviewScrollSnapshot(view.dom);
  const parent = view.dom.parentElement;
  const previewDom = preview.dom;
  previewDom.classList.add('toolbar-applied-preview-overlay', TOOLBAR_SELECTION_HIDDEN_PREVIEW_CLASS);
  previewDom.style.pointerEvents = themeStyleResetTokens.pointerEventsNone;
  previewDom.style.setProperty('overflow-anchor', 'none');

  previewOverlay = {
    key,
    node: previewDom,
    originalDoc: view.state.doc,
    originalViewDisplay: view.dom.style.display,
    previewState: preview.state,
    viewDom: view.dom,
  };

  parent.insertBefore(previewDom, view.dom);
  view.dom.style.display = themeStyleResetTokens.displayNone;
  view.dom.setAttribute('data-toolbar-preview-hidden', 'true');
  restorePreviewScrollSnapshot(scrollSnapshot);
  clearNativeSelectionForPreview(view);
  return true;
}

function clearSelectionColorPreview(): boolean {
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
  selectionColorPreview = null;
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

function renderSelectionColorPreview(
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

  selectionColorPreview = {
    key,
    originalDoc: view.state.doc,
    selection: getSelectionColorPreviewSignature(view),
    styleMutations: previewStyles.styleMutations,
    viewDom: view.dom,
  };
  clearNativeSelectionForPreviewFrames(view.dom);
  return true;
}

function renderSelectionHiddenPreview(view: EditorView, key: string): boolean {
  if (!(view.dom instanceof HTMLElement) || !(view.dom.parentElement instanceof HTMLElement)) {
    void key;
    return false;
  }

  if (!canRenderAppliedPreview(view)) {
    clearPreviewOverlay();
    return false;
  }

  if (hasMatchingPreview(view, key)) {
    return true;
  }

  clearPreviewOverlay();

  const scrollSnapshot = capturePreviewScrollSnapshot(view.dom);
  const previewDom = renderAppliedPreviewDocument(view.state, view.dom, view.dom.ownerDocument);
  previewDom.classList.add('toolbar-applied-preview-overlay', TOOLBAR_SELECTION_HIDDEN_PREVIEW_CLASS);
  previewDom.style.pointerEvents = themeStyleResetTokens.pointerEventsNone;
  previewDom.style.setProperty('overflow-anchor', 'none');

  previewOverlay = {
    key,
    node: previewDom,
    originalDoc: view.state.doc,
    originalViewDisplay: view.dom.style.display,
    previewState: view.state,
    viewDom: view.dom,
  };

  view.dom.parentElement.insertBefore(previewDom, view.dom);
  view.dom.style.display = themeStyleResetTokens.displayNone;
  view.dom.setAttribute('data-toolbar-preview-hidden', 'true');
  restorePreviewScrollSnapshot(scrollSnapshot);
  clearNativeSelectionForPreview(view);
  return true;
}

function clearPreviewOverlay(): boolean {
  if (!previewOverlay) {
    return false;
  }

  const { node, originalViewDisplay, viewDom } = previewOverlay;
  const scrollSnapshot = capturePreviewScrollSnapshot(viewDom);
  cleanupAppliedPreviewDocument(node);
  node.remove();
  if (viewDom.isConnected) {
    viewDom.style.display = originalViewDisplay;
    viewDom.removeAttribute('data-toolbar-preview-hidden');
  }
  previewOverlay = null;
  restorePreviewScrollSnapshot(scrollSnapshot);
  return true;
}

function clearFormatPreviewState(): boolean {
  const didClearPreview = clearPreviewOverlay();
  const didClearSelectionColorPreview = clearSelectionColorPreview();
  return didClearPreview || didClearSelectionColorPreview;
}

function setCollapsedSelectionNear(tr: EditorState['tr'], pos: number): void {
  const clampedPos = Math.max(0, Math.min(pos, tr.doc.content.size));

  try {
    tr.setSelection(TextSelection.create(tr.doc, clampedPos));
    return;
  } catch {
    // Fall back to the nearest valid cursor when the mapped end lands on a block boundary.
  }

  tr.setSelection(Selection.near(tr.doc.resolve(clampedPos), -1));
}

function dispatchPreviewState(view: EditorView, previewState: EditorState): boolean {
  const currentDoc = view.state.doc;
  const nextDoc = previewState.doc;
  const diffStart = (currentDoc.content as any).findDiffStart(nextDoc.content);

  if (diffStart === null) {
    if (!view.state.selection.empty) {
      const tr = view.state.tr;
      try {
        setCollapsedSelectionNear(tr, view.state.selection.to);
        view.dispatch(tr);
      } catch {
        return false;
      }
    }
    return true;
  }

  const diffEnd = (currentDoc.content as any).findDiffEnd(nextDoc.content);
  if (!diffEnd) {
    return false;
  }

  const tr = view.state.tr.replace(
    diffStart,
    diffEnd.a,
    nextDoc.slice(diffStart, diffEnd.b)
  );

  try {
    setCollapsedSelectionNear(tr, previewState.selection.to);
  } catch {
    // Keep ProseMirror's mapped selection if the preview selection cannot be restored.
  }

  markEditorUserInput(view);
  view.dispatch(tr);
  return true;
}

function commitPreview(view: EditorView, key: string): boolean {
  if (
    !previewOverlay ||
    previewOverlay.viewDom !== view.dom ||
    previewOverlay.key !== key ||
    !view.state.doc.eq(previewOverlay.originalDoc)
  ) {
    return false;
  }

  if (previewOverlay.previewState.doc.eq(view.state.doc)) {
    clearPreviewOverlay();
    return false;
  }

  return dispatchPreviewState(view, previewOverlay.previewState);
}

export function applyFormatPreview(view: EditorView, action: string, isActive: boolean = false): void {
  const key = `format:${action}:${isActive}`;
  if (hasMatchingPreview(view, key)) {
    return;
  }

  clearFormatPreviewState();

  const markName = FORMAT_MARKS[action];
  if (action === 'link') {
    if (!isActive) {
      return;
    }

    renderAppliedPreview(view, key, (previewView) => {
      setLink(previewView, null);
    });
    return;
  }

  if (!markName) {
    return;
  }

  renderAppliedPreview(view, key, (previewView) => {
    toggleMark(previewView, markName);
  });
}

export function applyTextColorPreview(view: EditorView, color: string | null): void {
  const key = `textColor:${color ?? 'default'}`;
  if (hasMatchingPreview(view, key)) {
    return;
  }
  if (refreshMatchingSelectionColorPreview(view, key)) {
    return;
  }

  clearFormatPreviewState();
  const didRenderAppliedPreview = renderAppliedPreview(view, key, (previewView) => {
    setTextColor(previewView, color);
  });
  if (!didRenderAppliedPreview) {
    renderSelectionColorPreview(view, 'text', color, key);
  }
}

export function applyBgColorPreview(view: EditorView, color: string | null): void {
  const key = `bgColor:${color ?? 'default'}`;
  if (hasMatchingPreview(view, key)) {
    return;
  }
  if (refreshMatchingSelectionColorPreview(view, key)) {
    return;
  }

  clearFormatPreviewState();
  const didRenderAppliedPreview = renderAppliedPreview(view, key, (previewView) => {
    setBgColor(previewView, color);
  });
  if (!didRenderAppliedPreview) {
    renderSelectionColorPreview(view, 'bg', color, key);
  }
}

export function applyColorPickerIdlePreview(view: EditorView): void {
  const key = 'colorPicker:idle';
  if (hasMatchingPreview(view, key)) {
    return;
  }
  if (refreshMatchingSelectionColorPreview(view, key)) {
    return;
  }

  if (!renderSelectionHiddenPreview(view, key)) {
    renderSelectionColorPreview(view, 'idle', null, key);
  }
}

export function applyAlignmentPreview(view: EditorView, alignment: TextAlignment): void {
  const key = `alignment:${alignment}`;
  if (hasMatchingPreview(view, key)) {
    return;
  }

  clearFormatPreviewState();
  renderAppliedPreview(view, key, (previewView) => {
    setTextAlignment(previewView, alignment);
  });
}

export function applyBlockPreview(view: EditorView, blockType: BlockType): void {
  const key = `block:${blockType}`;
  if (hasMatchingPreview(view, key)) {
    return;
  }

  clearFormatPreviewState();
  renderAppliedPreview(view, key, (previewView) => {
    convertBlockType(previewView, blockType);
  });
}

export function commitFormatPreview(view: EditorView, action: string, isActive: boolean = false): boolean {
  return commitPreview(view, `format:${action}:${isActive}`);
}

export function commitTextColorPreview(view: EditorView, color: string | null): boolean {
  return commitPreview(view, `textColor:${color ?? 'default'}`);
}

export function commitBgColorPreview(view: EditorView, color: string | null): boolean {
  return commitPreview(view, `bgColor:${color ?? 'default'}`);
}

export function commitAlignmentPreview(view: EditorView, alignment: TextAlignment): boolean {
  return commitPreview(view, `alignment:${alignment}`);
}

export function commitBlockPreview(view: EditorView, blockType: BlockType): boolean {
  return commitPreview(view, `block:${blockType}`);
}

export function clearFormatPreview(view: EditorView): void {
  if (clearFormatPreviewState()) {
    showTextSelectionOverlayForPreview(view);
  }
}
