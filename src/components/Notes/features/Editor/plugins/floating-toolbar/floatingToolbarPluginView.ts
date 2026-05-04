import { TextSelection, type PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { abortActiveAiSelectionReview } from './ai/reviewFlow';
import { createToolbarRenderer } from './renderToolbar';
import {
  calculateBottomPosition,
  calculatePosition,
  getActiveMarks,
  getBgColor,
  getCurrentAlignment,
  getCurrentBlockType,
  getLinkUrl,
  getTextColor,
} from './selectionHelpers';
import { TOOLBAR_ACTIONS, type FloatingToolbarState } from './types';
import {
  clampToolbarX,
  createToolbarElement,
  getBlockElementAtPos,
  getCurrentBlockElement,
  getScrollRoot,
  getToolbarRoot,
  hideToolbar,
  isFloatingToolbarSuppressed,
  showToolbar,
} from './floatingToolbarDom';
import {
  getContentLayoutContext,
  resolveToolbarContainerPosition,
  resolveToolbarViewportPosition,
} from './floatingToolbarLayout';

export interface FloatingToolbarInteractionState {
  isMouseDown: boolean;
  pendingShow: boolean;
  isPointerInsideToolbar: boolean;
}

export function createFloatingToolbarPluginView(
  editorView: EditorView,
  toolbarKey: PluginKey<FloatingToolbarState>,
  interactionState: FloatingToolbarInteractionState
) {
  let currentBlockElement: HTMLElement | null = null;
  let pendingRaf: number | null = null;
  let layoutRaf: number | null = null;
  let lastRenderState = '';
  let lastSelectionSignature = '';
  let lastToolbarX: number | null = null;
  let lastToolbarY: number | null = null;
  let lastToolbarPlacement: FloatingToolbarState['placement'] | null = null;
  let lastContainerWidth: number | null = null;
  let lastScrollLeft: number | null = null;
  let lastScrollTop: number | null = null;
  let lastTextSelection: { from: number; to: number } | null = null;

  const toolbarElement = createToolbarElement();
  const toolbarRenderer = createToolbarRenderer(toolbarElement);
  const scrollRoot = getScrollRoot(editorView);
  const toolbarRoot = getToolbarRoot(editorView);
  const positionRoot = toolbarRoot ?? scrollRoot ?? document.body;
  positionRoot.appendChild(toolbarElement);

  const ensureToolbarParent = (_isReviewMode: boolean) => {
    const targetParent = positionRoot;
    if (toolbarElement.parentElement !== targetParent) {
      targetParent.appendChild(toolbarElement);
    }
  };

  const resetToolbarTracking = () => {
    lastRenderState = '';
    currentBlockElement = null;
    lastSelectionSignature = '';
    lastToolbarX = null;
    lastToolbarY = null;
    lastToolbarPlacement = null;
    lastContainerWidth = null;
    lastScrollLeft = null;
    lastScrollTop = null;
    lastTextSelection = null;
  };

  const hideToolbarAndReset = () => {
    hideToolbar(toolbarElement);
    resetToolbarTracking();
  };

  const restoreLastSelection = () => {
    const selection = editorView.state.selection;
    if (!selection.empty || !lastTextSelection) {
      return;
    }

    const maxPos = editorView.state.doc.content.size;
    const from = Math.max(0, Math.min(lastTextSelection.from, maxPos));
    const to = Math.max(from, Math.min(lastTextSelection.to, maxPos));
    if (from === to) {
      return;
    }

    editorView.dispatch(
      editorView.state.tr
        .setSelection(TextSelection.create(editorView.state.doc, from, to))
        .setMeta('addToHistory', false)
    );
  };

  const restoreSelectionForToolbar = () => {
    if (!interactionState.isPointerInsideToolbar) {
      return false;
    }

    restoreLastSelection();
    return true;
  };

  const getContentBounds = () => {
    const layout = getContentLayoutContext(editorView, positionRoot instanceof HTMLElement ? positionRoot : null);
    if (!layout.container || !layout.containerRect || !layout.containerBounds) {
      return null;
    }

    return layout.containerBounds;
  };

  const correctToolbarToContentBounds = (x: number) => {
    const container = positionRoot instanceof HTMLElement ? positionRoot : null;
    if (!container) {
      return x;
    }

    const layout = getContentLayoutContext(editorView, container);
    const contentLeft = layout.viewportBounds.left;
    const contentRight = layout.viewportBounds.right;
    const toolbarBodyNode = toolbarElement.querySelector<HTMLElement>('.floating-toolbar-inner');
    const toolbarRect = (toolbarBodyNode instanceof HTMLElement ? toolbarBodyNode : toolbarElement).getBoundingClientRect();
    const contentWidth = Math.max(0, contentRight - contentLeft);
    const toolbarWidth = toolbarRect.width;

    let correctedX = x;
    if (toolbarWidth >= contentWidth) {
      correctedX += contentLeft - toolbarRect.left;
    } else if (toolbarRect.left < contentLeft) {
      correctedX += contentLeft - toolbarRect.left;
      if (toolbarRect.right > contentRight) {
        correctedX -= toolbarRect.right - contentRight;
      }
    } else if (toolbarRect.right > contentRight) {
      correctedX -= toolbarRect.right - contentRight;
    }

    if (correctedX !== x) {
      toolbarElement.style.left = `${correctedX}px`;
    }

    return correctedX;
  };

  const correctSubmenusToContentBounds = () => {
    const layout = getContentLayoutContext(editorView, positionRoot instanceof HTMLElement ? positionRoot : null);
    const contentLeft = layout.viewportBounds.left;
    const contentRight = layout.viewportBounds.right;

    const visibleSubmenus = Array.from(
      toolbarElement.querySelectorAll<HTMLElement>('.toolbar-submenu')
    ).filter((submenu) => submenu.offsetParent !== null);

    for (const submenu of visibleSubmenus) {
      submenu.style.removeProperty('--toolbar-submenu-shift-x');

      const submenuRect = submenu.getBoundingClientRect();
      let shiftX = 0;

      if (submenuRect.left < contentLeft) {
        shiftX += contentLeft - submenuRect.left;
      }

      if (submenuRect.right > contentRight) {
        shiftX -= submenuRect.right - contentRight;
      }

      if (shiftX !== 0) {
        submenu.style.setProperty('--toolbar-submenu-shift-x', `${shiftX}px`);
      }
    }
  };

  const syncAiReviewWidth = (
    isReviewModeActive: boolean,
    pluginState: FloatingToolbarState | undefined
  ) => {
    currentBlockElement = isReviewModeActive && pluginState?.aiReview
      ? getBlockElementAtPos(editorView, pluginState.aiReview.from)
      : getCurrentBlockElement(editorView);

    if (isReviewModeActive && currentBlockElement) {
      toolbarElement.style.setProperty(
        '--ai-review-width',
        `${Math.round(currentBlockElement.getBoundingClientRect().width)}px`
      );
      return;
    }

    toolbarElement.style.removeProperty('--ai-review-width');
  };

  const renderToolbarIfNeeded = (
    pluginState: FloatingToolbarState,
    toolbarState: {
      activeMarks: Set<string>;
      currentBlockType: ReturnType<typeof getCurrentBlockType>;
      currentAlignment: ReturnType<typeof getCurrentAlignment>;
      linkUrl: ReturnType<typeof getLinkUrl>;
      textColor: ReturnType<typeof getTextColor>;
      bgColor: ReturnType<typeof getBgColor>;
    }
  ) => {
    const cacheKey = [
      Array.from(toolbarState.activeMarks).sort().join(','),
      toolbarState.currentBlockType,
      toolbarState.currentAlignment,
      toolbarState.linkUrl || '',
      toolbarState.textColor || '',
      toolbarState.bgColor || '',
      pluginState.copied ? 'copied' : '',
      pluginState.subMenu || '',
      pluginState.aiReview?.instruction || '',
      pluginState.aiReview?.originalText || '',
      pluginState.aiReview?.suggestedText || '',
      pluginState.aiReview?.isLoading ? 'loading' : '',
    ].join('|');

    if (cacheKey === lastRenderState) {
      return;
    }

    lastRenderState = cacheKey;
    toolbarRenderer.render(editorView, {
      ...pluginState,
      ...toolbarState,
    });
  };

  const resolveDisplayedToolbarPosition = (args: {
    pluginState: FloatingToolbarState;
    isReviewModeActive: boolean;
    selection: TextSelection;
  }) => {
    const { pluginState, isReviewModeActive, selection } = args;
    const aiPosition = calculateBottomPosition(editorView);
    const layout = getContentLayoutContext(
      editorView,
      positionRoot instanceof HTMLElement ? positionRoot : null
    );
    const nextPosition = resolveToolbarViewportPosition({
      aiPosition,
      layout,
      pluginState,
      selectionPosition: calculatePosition(editorView),
    });

    const containerPosition = resolveToolbarContainerPosition(
      pluginState,
      nextPosition,
      positionRoot instanceof HTMLElement ? positionRoot : null
    );

    const isAiMode = pluginState.subMenu === 'ai' || pluginState.subMenu === 'aiReview';
    const containerWidth = positionRoot instanceof HTMLElement ? positionRoot.clientWidth : null;
    const currentScrollLeft = scrollRoot?.scrollLeft ?? 0;
    const currentScrollTop = scrollRoot?.scrollTop ?? 0;
    const selectionSignature = isReviewModeActive && pluginState.aiReview
      ? `${pluginState.aiReview.from}:${pluginState.aiReview.to}`
      : `${selection.from}:${selection.to}`;
    const clamped = clampToolbarX(
      containerPosition.x,
      positionRoot instanceof HTMLElement ? positionRoot : null,
      isAiMode,
      toolbarElement,
      getContentBounds()
    );
    const shouldFreezeX =
      pluginState.subMenu !== 'aiReview' &&
      lastToolbarX !== null &&
      lastSelectionSignature === selectionSignature &&
      lastContainerWidth === containerWidth;
    const shouldFreezeBlockMenuPosition =
      pluginState.subMenu === 'block' &&
      lastToolbarX !== null &&
      lastToolbarY !== null &&
      lastToolbarPlacement !== null &&
      lastScrollLeft === currentScrollLeft &&
      lastScrollTop === currentScrollTop &&
      lastSelectionSignature === selectionSignature &&
      lastContainerWidth === containerWidth;
    const finalX = shouldFreezeBlockMenuPosition && lastToolbarX !== null
      ? lastToolbarX
      : shouldFreezeX && lastToolbarX !== null
        ? lastToolbarX
        : clamped.clampedX;
    const finalY = shouldFreezeBlockMenuPosition && lastToolbarY !== null
      ? lastToolbarY
      : containerPosition.y;
    const finalPlacement = shouldFreezeBlockMenuPosition && lastToolbarPlacement !== null
      ? lastToolbarPlacement
      : nextPosition.placement;

    return {
      containerWidth,
      finalPlacement,
      finalX,
      finalY,
      currentScrollLeft,
      currentScrollTop,
      selectionSignature,
    };
  };

  const updateToolbar = () => {
    const pluginState = toolbarKey.getState(editorView.state);
    const isReviewModeActive = pluginState?.subMenu === 'aiReview' && Boolean(pluginState.aiReview);
    ensureToolbarParent(isReviewModeActive);
    let { selection } = editorView.state;

    if (isFloatingToolbarSuppressed()) {
      hideToolbarAndReset();
      return;
    }

    if (!pluginState?.isVisible) {
      hideToolbarAndReset();
      return;
    }

    if (!isReviewModeActive && (selection.empty || !(selection instanceof TextSelection))) {
      if (restoreSelectionForToolbar()) {
        selection = editorView.state.selection;
      }
    }

    if (!isReviewModeActive && (selection.empty || !(selection instanceof TextSelection))) {
      hideToolbarAndReset();
      return;
    }

    syncAiReviewWidth(isReviewModeActive, pluginState);

    const activeMarks = getActiveMarks(editorView);
    const currentBlockType = getCurrentBlockType(editorView);
    const currentAlignment = getCurrentAlignment(editorView);
    const linkUrl = getLinkUrl(editorView);
    const textColor = getTextColor(editorView);
    const bgColor = getBgColor(editorView);
    renderToolbarIfNeeded(pluginState, {
      activeMarks,
      currentBlockType,
      currentAlignment,
      linkUrl,
      textColor,
      bgColor,
    });

    const {
      containerWidth,
      finalPlacement,
      finalX,
      finalY,
      currentScrollLeft,
      currentScrollTop,
      selectionSignature,
    } = resolveDisplayedToolbarPosition({
      pluginState,
      isReviewModeActive,
      selection,
    });

    showToolbar(
      toolbarElement,
      { x: finalX, y: finalY },
      finalPlacement,
      pluginState.subMenu === 'aiReview'
    );
    const correctedX = pluginState.subMenu === 'aiReview'
      ? finalX
      : correctToolbarToContentBounds(finalX);
    correctSubmenusToContentBounds();

    lastSelectionSignature = selectionSignature;
    lastToolbarX = correctedX;
    lastToolbarY = finalY;
    lastToolbarPlacement = finalPlacement;
    lastContainerWidth = containerWidth;
    lastScrollLeft = currentScrollLeft;
    lastScrollTop = currentScrollTop;
  };

  const scheduleToolbarUpdate = () => {
    if (layoutRaf !== null) {
      return;
    }

    layoutRaf = requestAnimationFrame(() => {
      layoutRaf = null;
      updateToolbar();
    });
  };

  const bindGlobalListeners = (resizeObserver: ResizeObserver | null) => {
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    toolbarElement.addEventListener('mouseenter', handleToolbarPointerEnter);
    toolbarElement.addEventListener('mouseleave', handleToolbarPointerLeave);
    window.addEventListener('resize', scheduleToolbarUpdate);
    scrollRoot?.addEventListener('scroll', scheduleToolbarUpdate, { passive: true });
    resizeObserver?.observe(editorView.dom);
    resizeObserver?.observe(toolbarElement);
    if (scrollRoot) {
      resizeObserver?.observe(scrollRoot);
    }
    if (toolbarRoot && toolbarRoot !== scrollRoot) {
      resizeObserver?.observe(toolbarRoot);
    }
  };

  const unbindGlobalListeners = (resizeObserver: ResizeObserver | null) => {
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mousedown', handleClickOutside);
    document.removeEventListener('keydown', handleEscape);
    toolbarElement.removeEventListener('mouseenter', handleToolbarPointerEnter);
    toolbarElement.removeEventListener('mouseleave', handleToolbarPointerLeave);
    window.removeEventListener('resize', scheduleToolbarUpdate);
    scrollRoot?.removeEventListener('scroll', scheduleToolbarUpdate);
    resizeObserver?.disconnect();
  };

  const handleMouseDown = () => {
    interactionState.isMouseDown = true;
    interactionState.pendingShow = false;
  };

  const handleMouseUp = () => {
    interactionState.isMouseDown = false;
    if (isFloatingToolbarSuppressed()) {
      interactionState.pendingShow = false;
      hideToolbar(toolbarElement);
      return;
    }

    if (!interactionState.pendingShow) {
      return;
    }

    interactionState.pendingShow = false;
    if (pendingRaf !== null) {
      cancelAnimationFrame(pendingRaf);
    }

    pendingRaf = requestAnimationFrame(() => {
      pendingRaf = null;
      if (interactionState.isMouseDown) {
        return;
      }
      if (isFloatingToolbarSuppressed()) {
        return;
      }

      const { selection } = editorView.state;
      if (!selection.empty) {
        editorView.dispatch(
          editorView.state.tr.setMeta(toolbarKey, {
            type: TOOLBAR_ACTIONS.SHOW,
          })
        );
      }
    });
  };

  const handleToolbarPointerEnter = () => {
    interactionState.isPointerInsideToolbar = true;
    restoreLastSelection();
  };

  const handleToolbarPointerLeave = () => {
    interactionState.isPointerInsideToolbar = false;
    if (!editorView.state.selection.empty) {
      return;
    }

    editorView.dispatch(
      editorView.state.tr.setMeta(toolbarKey, {
        type: TOOLBAR_ACTIONS.HIDE,
      })
    );
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (!toolbarElement || toolbarElement.contains(event.target as Node)) {
      return;
    }

    const pluginState = toolbarKey.getState(editorView.state);
    if (pluginState?.subMenu === 'aiReview') {
      abortActiveAiSelectionReview(editorView);
      editorView.dispatch(
        editorView.state.tr.setMeta(toolbarKey, {
          type: TOOLBAR_ACTIONS.HIDE,
        })
      );
      return;
    }

    if (!pluginState?.subMenu) {
      return;
    }

    editorView.dispatch(
      editorView.state.tr.setMeta(toolbarKey, {
        type: TOOLBAR_ACTIONS.SET_SUB_MENU,
        payload: { subMenu: null },
      })
    );
  };

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') {
      return;
    }

    const pluginState = toolbarKey.getState(editorView.state);
    if (!pluginState?.isVisible) {
      return;
    }

    abortActiveAiSelectionReview(editorView);
    editorView.dispatch(
      editorView.state.tr.setMeta(toolbarKey, {
        type: TOOLBAR_ACTIONS.HIDE,
      })
    );
  };

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => {
        scheduleToolbarUpdate();
      })
    : null;

  bindGlobalListeners(resizeObserver);

  return {
    update(view: EditorView) {
      const { selection } = view.state;
      if (!selection.empty && selection instanceof TextSelection) {
        lastTextSelection = {
          from: selection.from,
          to: selection.to,
        };
      }

      updateToolbar();
    },
    destroy() {
      abortActiveAiSelectionReview(editorView);
      if (pendingRaf !== null) {
        cancelAnimationFrame(pendingRaf);
      }
      if (layoutRaf !== null) {
        cancelAnimationFrame(layoutRaf);
      }

      unbindGlobalListeners(resizeObserver);
      toolbarRenderer.destroy();
      toolbarElement.remove();
      resetToolbarTracking();
      interactionState.isPointerInsideToolbar = false;
      interactionState.isMouseDown = false;
      interactionState.pendingShow = false;
    },
  };
}
