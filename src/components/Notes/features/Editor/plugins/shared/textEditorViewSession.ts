import type { EditorView } from '@milkdown/kit/prose/view';
import { getScrollRoot } from '../floating-toolbar/floatingToolbarDom';
import { createTextEditorPopupAnchorResizeTracker } from './textEditorPopupAnchorResize';
import {
  mountTextEditorPopup,
  resizeTextEditorPopupTextareaToContent,
  TEXT_EDITOR_POPUP_CARD_SELECTOR,
} from './textEditorPopupDom';
import { resolveTextEditorPopupPlacement } from './textEditorPopupPlacement';
import { themeDomStyleTokens, themeUiFeedbackTokens } from '@/styles/themeTokens';
import { markEditorUserInput } from './userInputEvents';

export interface TextEditorSessionState {
  isOpen: boolean;
  nodePos: number;
  position: { x: number; y: number };
}

export interface TextEditorSessionRefs {
  textareaElement: HTMLTextAreaElement | null;
}

export interface TextEditorSessionActionArgs<
  TState extends TextEditorSessionState,
  TRefs extends TextEditorSessionRefs,
> {
  editorView: EditorView;
  refs: TRefs;
  getEditorState: () => TState | undefined;
  resetSessionDom: () => void;
}

export interface TextEditorPreviewArgs<
  TState extends TextEditorSessionState,
  TRefs extends TextEditorSessionRefs,
> {
  state: TState;
  refs: TRefs;
  value: string;
  resolveAnchor: () => HTMLElement | null;
  scheduleResize: () => void;
}

export interface CreateTextEditorViewSessionArgs<
  TState extends TextEditorSessionState,
  TRefs extends TextEditorSessionRefs,
> {
  editorView: EditorView;
  onOutsideCloseIntent: () => void;
  refs: TRefs;
  popupClassName: string;
  placeholder: string;
  getEditorState: () => TState | undefined;
  getStateRenderKey: (state: TState) => string;
  getValue: (state: TState) => string;
  setInitialValue: (refs: TRefs, value: string) => void;
  setDraftValue: (refs: TRefs, value: string) => void;
  getInitialValue: (refs: TRefs) => string;
  resetRefs: (refs: TRefs) => void;
  resolveAnchorElement: (state: TState | undefined, nodeDom: Node | null) => HTMLElement | null;
  getAnchorViewportPosition: (anchorElement: HTMLElement | null) => { x: number; y: number };
  preferStatePositionOnInitialRender?: (state: TState) => boolean;
  scrollPopupIntoViewOnInitialRender?: boolean;
  constrainTextareaHeightToViewport?: boolean;
  previewInput: (args: TextEditorPreviewArgs<TState, TRefs>) => void;
  previewInputDebounceMs?: number;
  previewCancel: (args: TextEditorPreviewArgs<TState, TRefs>) => void;
  cancelSession: (args: TextEditorSessionActionArgs<TState, TRefs>) => void;
  saveSession: (args: TextEditorSessionActionArgs<TState, TRefs>) => void;
}

export function createTextEditorViewSession<
  TState extends TextEditorSessionState,
  TRefs extends TextEditorSessionRefs,
>(args: CreateTextEditorViewSessionArgs<TState, TRefs>) {
  const {
    editorView,
    onOutsideCloseIntent,
    refs,
    popupClassName,
    placeholder,
    getEditorState,
    getStateRenderKey,
    getValue,
    setInitialValue,
    setDraftValue,
    getInitialValue,
    resetRefs,
    resolveAnchorElement,
    getAnchorViewportPosition,
    preferStatePositionOnInitialRender,
    scrollPopupIntoViewOnInitialRender,
    constrainTextareaHeightToViewport = true,
    previewInput,
    previewInputDebounceMs = themeUiFeedbackTokens.editorTextEditorLivePreviewDebounceMs,
    previewCancel,
    cancelSession,
    saveSession,
  } = args;
  let editorElement: HTMLElement | null = null;
  let renderedKey: string | null = null;
  let suppressOutsideMouseDown = false;
  let suppressOutsideMouseDownTimer: number | null = null;
  let focusTextareaTimer: number | null = null;
  let previewInputTimer: number | null = null;
  let textareaResizeFrame: number | null = null;
  let anchorPositionFrame: number | null = null;
  let popupVisibilityFrame: number | null = null;
  let pendingPreviewInputArgs: TextEditorPreviewArgs<TState, TRefs> | null = null;
  const scrollRoot = getScrollRoot(editorView);
  const contentRoot = editorView.dom.closest('[data-note-content-root="true"]') as HTMLElement | null;
  const positionRoot = contentRoot ?? scrollRoot;

  const resolveCurrentAnchorElement = (state: TState | undefined) => {
    if (!state?.isOpen) {
      return null;
    }

    const nodeDom = typeof editorView.nodeDOM === 'function' ? editorView.nodeDOM(state.nodePos) : null;
    return resolveAnchorElement(state, nodeDom);
  };

  const clearEditorElements = () => {
    if (editorElement) {
      editorElement.remove();
    }
    editorElement = null;
    refs.textareaElement = null;
  };

  const clearPendingPreviewInput = () => {
    pendingPreviewInputArgs = null;
    if (previewInputTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(previewInputTimer);
    }
    previewInputTimer = null;
  };

  const clearPendingTextareaResize = () => {
    if (textareaResizeFrame !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(textareaResizeFrame);
    }
    textareaResizeFrame = null;
  };

  const clearPendingPopupVisibilityScroll = () => {
    if (popupVisibilityFrame !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(popupVisibilityFrame);
    }
    popupVisibilityFrame = null;
  };

  const resizeTextareaToContent = () => {
    if (!editorElement || !refs.textareaElement) {
      return;
    }

    const card = editorElement.querySelector(TEXT_EDITOR_POPUP_CARD_SELECTOR);
    if (card instanceof HTMLElement) {
      resizeTextEditorPopupTextareaToContent({
        card,
        textarea: refs.textareaElement,
        constrainToViewport: constrainTextareaHeightToViewport,
      });
    }
  };

  const scheduleTextareaResize = () => {
    if (typeof window === 'undefined') {
      resizeTextareaToContent();
      return;
    }

    if (textareaResizeFrame !== null) {
      return;
    }

    textareaResizeFrame = window.requestAnimationFrame(() => {
      textareaResizeFrame = null;
      resizeTextareaToContent();
    });
  };

  const flushPendingPreviewInput = () => {
    if (!pendingPreviewInputArgs) {
      return;
    }
    const nextArgs = pendingPreviewInputArgs;
    clearPendingPreviewInput();
    previewInput(nextArgs);
  };

  const schedulePreviewInput = (previewArgs: TextEditorPreviewArgs<TState, TRefs>) => {
    pendingPreviewInputArgs = previewArgs;
    if (previewInputDebounceMs <= 0 || typeof window === 'undefined') {
      flushPendingPreviewInput();
      return;
    }

    if (previewInputTimer !== null) {
      window.clearTimeout(previewInputTimer);
    }
    previewInputTimer = window.setTimeout(() => {
      previewInputTimer = null;
      flushPendingPreviewInput();
    }, previewInputDebounceMs);
  };

  const resetSessionDom = () => {
    clearPendingPreviewInput();
    clearPendingTextareaResize();
    clearPendingPopupVisibilityScroll();
    clearEditorElements();
    resetRefs(refs);
    renderedKey = null;
  };

  const getSessionActionArgs = (): TextEditorSessionActionArgs<TState, TRefs> => ({
    editorView,
    refs,
    getEditorState,
    resetSessionDom,
  });

  const scheduleOutsideMouseDownSuppression = () => {
    suppressOutsideMouseDown = true;
    if (suppressOutsideMouseDownTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(suppressOutsideMouseDownTimer);
    }

    if (typeof window === 'undefined') {
      return;
    }

    suppressOutsideMouseDownTimer = window.setTimeout(() => {
      suppressOutsideMouseDown = false;
      suppressOutsideMouseDownTimer = null;
    }, 0);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (suppressOutsideMouseDown) {
      return;
    }

    if (editorElement && !editorElement.contains(event.target as Node)) {
      onOutsideCloseIntent();
      clearPendingPreviewInput();
      saveSession(getSessionActionArgs());
    }
  };

  const resolveViewportPosition = (state: TState) => {
    const anchor = resolveCurrentAnchorElement(state);
    return anchor ? getAnchorViewportPosition(anchor) : state.position;
  };

  const updateEditorPosition = (state: TState, options?: {
    deferAnchorUpdate?: boolean;
    deferResize?: boolean;
    useStatePosition?: boolean;
  }) => {
    if (!editorElement) {
      return;
    }

    const nextPosition = resolveTextEditorPopupPlacement({
      editorView,
      positionRoot,
      viewportPosition: options?.useStatePosition ? state.position : resolveViewportPosition(state),
    });
    const popupWidth = `${Math.round(nextPosition.width)}px`;
    editorElement.style.setProperty('--vlaina-text-editor-popup-width', popupWidth);
    editorElement.style.setProperty('--vlaina-math-editor-width', popupWidth);
    editorElement.style.setProperty('--vlaina-width-math-editor', popupWidth);
    editorElement.style.setProperty('--vlaina-width-math-editor-mobile', popupWidth);
    editorElement.style.left = `${nextPosition.x}px`;
    editorElement.style.top = `${nextPosition.y}px`;

    if (options?.deferResize) {
      scheduleTextareaResize();
    } else {
      clearPendingTextareaResize();
      resizeTextareaToContent();
    }

    if (!options?.deferAnchorUpdate) {
      anchorResizeTracker.update();
    }
  };

  const anchorResizeTracker = createTextEditorPopupAnchorResizeTracker({
    resolveAnchor: () => resolveCurrentAnchorElement(getEditorState()),
    onAnchorResize() {
      const state = getEditorState();
      if (state?.isOpen) {
        updateEditorPosition(state);
      }
    },
  });

  const scheduleAnchorPositionRefresh = () => {
    if (typeof window === 'undefined') {
      const state = getEditorState();
      if (state?.isOpen) {
        updateEditorPosition(state);
      }
      return;
    }

    if (anchorPositionFrame !== null) {
      return;
    }

    anchorPositionFrame = window.requestAnimationFrame(() => {
      anchorPositionFrame = null;
      const state = getEditorState();
      if (state?.isOpen) {
        updateEditorPosition(state, { deferResize: true });
      }
    });
  };

  const scrollPopupIntoView = () => {
    editorElement?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const scheduleInitialPopupVisibilityScroll = () => {
    if (!scrollPopupIntoViewOnInitialRender) {
      return;
    }

    if (typeof window === 'undefined') {
      scrollPopupIntoView();
      return;
    }

    if (popupVisibilityFrame !== null) {
      return;
    }

    popupVisibilityFrame = window.requestAnimationFrame(() => {
      popupVisibilityFrame = null;
      scrollPopupIntoView();
    });
  };

  const focusTextareaNow = () => {
    const nextTextarea = refs.textareaElement;
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

  const focusTextareaAtEnd = () => {
    if (focusTextareaTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(focusTextareaTimer);
    }

    if (typeof window === 'undefined') {
      focusTextareaNow();
      return;
    }

    focusTextareaNow();
    focusTextareaTimer = window.setTimeout(() => {
      focusTextareaTimer = null;
      focusTextareaNow();
    }, 0);
  };

  const ensureEditorElement = () => {
    if (editorElement) {
      return editorElement;
    }

    editorElement = document.createElement('div');
    editorElement.className = popupClassName;
    editorElement.style.position = positionRoot ? 'absolute' : 'fixed';
    editorElement.style.zIndex = themeDomStyleTokens.zIndexTextEditorPopup;
    (positionRoot ?? document.body).appendChild(editorElement);
    return editorElement;
  };

  const renderEditor = (state: TState) => {
    const container = ensureEditorElement();
    const value = getValue(state);
    setInitialValue(refs, value);
    setDraftValue(refs, value);

    const { textarea } = mountTextEditorPopup({
      container,
      value,
      placeholder,
      onResizeRequest: scheduleTextareaResize,
      onInput(nextValue) {
        markEditorUserInput(editorView);
        setDraftValue(refs, nextValue);
        schedulePreviewInput({
          state,
          refs,
          value: nextValue,
          resolveAnchor: () => resolveCurrentAnchorElement(getEditorState()),
          scheduleResize: anchorResizeTracker.scheduleResize,
        });
      },
      onCancel() {
        clearPendingPreviewInput();
        previewCancel({
          state,
          refs,
          value: getInitialValue(refs),
          resolveAnchor: () => resolveCurrentAnchorElement(getEditorState()),
          scheduleResize: anchorResizeTracker.scheduleResize,
        });
        cancelSession(getSessionActionArgs());
      },
      onSave() {
        clearPendingPreviewInput();
        saveSession(getSessionActionArgs());
      },
    });

    refs.textareaElement = textarea;
    renderedKey = getStateRenderKey(state);
    scheduleOutsideMouseDownSuppression();
    focusTextareaAtEnd();
  };

  document.addEventListener('mousedown', handleClickOutside, true);

  return {
    update() {
      const state = getEditorState();

      if (!state?.isOpen) {
        anchorResizeTracker.update();
        resetSessionDom();
        return;
      }

      const nextRenderedKey = getStateRenderKey(state);
      let didRenderEditor = false;
      if (renderedKey !== nextRenderedKey || !refs.textareaElement) {
        renderEditor(state);
        didRenderEditor = true;
      }

      const useInitialStatePosition = didRenderEditor && Boolean(preferStatePositionOnInitialRender?.(state));
      updateEditorPosition(state, {
        deferAnchorUpdate: useInitialStatePosition,
        deferResize: didRenderEditor,
        useStatePosition: useInitialStatePosition,
      });
      if (useInitialStatePosition) {
        scheduleAnchorPositionRefresh();
      }
      if (didRenderEditor) {
        scheduleInitialPopupVisibilityScroll();
      }
    },
    destroy() {
      document.removeEventListener('mousedown', handleClickOutside, true);
      if (suppressOutsideMouseDownTimer !== null && typeof window !== 'undefined') {
        window.clearTimeout(suppressOutsideMouseDownTimer);
      }
      if (focusTextareaTimer !== null && typeof window !== 'undefined') {
        window.clearTimeout(focusTextareaTimer);
      }
      if (anchorPositionFrame !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(anchorPositionFrame);
      }
      clearPendingPopupVisibilityScroll();
      clearPendingTextareaResize();
      clearPendingPreviewInput();
      anchorResizeTracker.destroy();
      resetSessionDom();
      suppressOutsideMouseDown = false;
      suppressOutsideMouseDownTimer = null;
      focusTextareaTimer = null;
      anchorPositionFrame = null;
      popupVisibilityFrame = null;
    },
  };
}
