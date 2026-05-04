import { TextSelection, type PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { abortActiveAiSelectionReview } from './ai/reviewFlow';
import { createToolbarRenderer } from './renderToolbar';
import {
  calculateBottomPosition,
  calculateBottomPositionForRange,
  calculatePosition,
  calculatePositionForRange,
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
  let lastSelectionToolbarRenderState = '';
  let selectionToolbarSubMenu: FloatingToolbarState['subMenu'] = null;

  const toolbarElement = createToolbarElement();
  const toolbarRenderer = createToolbarRenderer(toolbarElement);
  const selectionToolbarElement = createToolbarElement();
  const selectionToolbarRenderer = createToolbarRenderer(selectionToolbarElement, {
    onToggleSubMenu: (_view, currentState, nextSubMenu) => {
      selectionToolbarSubMenu = currentState?.subMenu === nextSubMenu ? null : nextSubMenu;
      lastSelectionToolbarRenderState = '';
      scheduleToolbarUpdate();
      return false;
    },
    onCloseToolbar: () => {
      selectionToolbarSubMenu = null;
      lastSelectionToolbarRenderState = '';
      hideToolbar(selectionToolbarElement);
      scheduleToolbarUpdate();
      return true;
    },
  });
  const scrollRoot = getScrollRoot(editorView);
  const toolbarRoot = getToolbarRoot(editorView);
  const positionRoot = toolbarRoot ?? scrollRoot ?? document.body;
  const reviewToolbars = new Map<string, {
    element: HTMLElement;
    renderer: ReturnType<typeof createToolbarRenderer>;
    lastRenderState: string;
  }>();
  positionRoot.appendChild(toolbarElement);
  positionRoot.appendChild(selectionToolbarElement);

  const ensureToolbarParent = (_isReviewMode: boolean) => {
    const targetParent = positionRoot;
    if (toolbarElement.parentElement !== targetParent) {
      targetParent.appendChild(toolbarElement);
    }
    if (selectionToolbarElement.parentElement !== targetParent) {
      targetParent.appendChild(selectionToolbarElement);
    }
    reviewToolbars.forEach(({ element }) => {
      if (element.parentElement !== targetParent) {
        targetParent.appendChild(element);
      }
    });
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
    lastSelectionToolbarRenderState = '';
    selectionToolbarSubMenu = null;
  };

  const hideToolbarAndReset = () => {
    hideToolbar(toolbarElement);
    hideToolbar(selectionToolbarElement);
    reviewToolbars.forEach(({ element }) => hideToolbar(element));
    resetToolbarTracking();
  };

  const destroyReviewToolbar = (requestKey: string) => {
    const entry = reviewToolbars.get(requestKey);
    if (!entry) {
      return;
    }

    entry.renderer.destroy();
    entry.element.remove();
    reviewToolbars.delete(requestKey);
  };

  const getReviewToolbar = (requestKey: string) => {
    const existing = reviewToolbars.get(requestKey);
    if (existing) {
      return existing;
    }

    const element = createToolbarElement();
    const renderer = createToolbarRenderer(element);
    positionRoot.appendChild(element);
    const entry = {
      element,
      renderer,
      lastRenderState: '',
    };
    reviewToolbars.set(requestKey, entry);
    return entry;
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

  const correctToolbarToContentBounds = (toolbar: HTMLElement, x: number) => {
    const container = positionRoot instanceof HTMLElement ? positionRoot : null;
    if (!container) {
      return x;
    }

    const layout = getContentLayoutContext(editorView, container);
    const contentLeft = layout.viewportBounds.left;
    const contentRight = layout.viewportBounds.right;
    const toolbarBodyNode = toolbar.querySelector<HTMLElement>('.floating-toolbar-inner');
    const toolbarRect = (toolbarBodyNode instanceof HTMLElement ? toolbarBodyNode : toolbar).getBoundingClientRect();
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
      toolbar.style.left = `${correctedX}px`;
    }

    return correctedX;
  };

  const correctSubmenusToContentBounds = (toolbar: HTMLElement) => {
    const layout = getContentLayoutContext(editorView, positionRoot instanceof HTMLElement ? positionRoot : null);
    const contentLeft = layout.viewportBounds.left;
    const contentRight = layout.viewportBounds.right;

    const visibleSubmenus = Array.from(
      toolbar.querySelectorAll<HTMLElement>('.toolbar-submenu')
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
    const cacheKey = pluginState.subMenu === 'aiReview' && pluginState.aiReview
      ? [
          'aiReview',
          pluginState.aiReview.requestKey,
          pluginState.aiReview.from,
          pluginState.aiReview.to,
          pluginState.aiReview.instruction || '',
          pluginState.aiReview.commandId || '',
          pluginState.aiReview.toneId || '',
          pluginState.aiReview.originalText || '',
          pluginState.aiReview.suggestedText || '',
          pluginState.aiReview.errorMessage || '',
          pluginState.aiReview.isLoading ? 'loading' : '',
        ].join('|')
      : [
          Array.from(toolbarState.activeMarks).sort().join(','),
          toolbarState.currentBlockType,
          toolbarState.currentAlignment,
          toolbarState.linkUrl || '',
          toolbarState.textColor || '',
          toolbarState.bgColor || '',
          pluginState.copied ? 'copied' : '',
          pluginState.subMenu || '',
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

  const updateSelectionToolbarForReview = (
    pluginState: FloatingToolbarState,
    toolbarState: {
      activeMarks: Set<string>;
      currentBlockType: ReturnType<typeof getCurrentBlockType>;
      currentAlignment: ReturnType<typeof getCurrentAlignment>;
      linkUrl: ReturnType<typeof getLinkUrl>;
      textColor: ReturnType<typeof getTextColor>;
      bgColor: ReturnType<typeof getBgColor>;
    },
    selection: EditorView['state']['selection']
  ) => {
    if (
      pluginState.subMenu !== 'aiReview' ||
      !pluginState.aiReview ||
      selection.empty ||
      !(selection instanceof TextSelection) ||
      (selection.from === pluginState.aiReview.from && selection.to === pluginState.aiReview.to)
    ) {
      hideToolbar(selectionToolbarElement);
      lastSelectionToolbarRenderState = '';
      selectionToolbarSubMenu = null;
      return;
    }

    const selectionState: FloatingToolbarState = {
      ...pluginState,
      subMenu: selectionToolbarSubMenu,
      aiReview: null,
      dragPosition: null,
      isVisible: true,
      copied: false,
    };
    const renderState = [
      selection.from,
      selection.to,
      selectionToolbarSubMenu || '',
      Array.from(toolbarState.activeMarks).sort().join(','),
      toolbarState.currentBlockType,
      toolbarState.currentAlignment,
      toolbarState.linkUrl || '',
      toolbarState.textColor || '',
      toolbarState.bgColor || '',
    ].join('|');

    if (renderState !== lastSelectionToolbarRenderState) {
      lastSelectionToolbarRenderState = renderState;
      selectionToolbarRenderer.render(editorView, {
        ...selectionState,
        ...toolbarState,
      });
    }

    const layout = getContentLayoutContext(
      editorView,
      positionRoot instanceof HTMLElement ? positionRoot : null
    );
    const nextPosition = calculatePosition(editorView);
    const containerPosition = resolveToolbarContainerPosition(
      selectionState,
      nextPosition,
      positionRoot instanceof HTMLElement ? positionRoot : null
    );
    const clamped = clampToolbarX(
      containerPosition.x,
      positionRoot instanceof HTMLElement ? positionRoot : null,
      false,
      selectionToolbarElement,
      layout.containerBounds
    );

    showToolbar(
      selectionToolbarElement,
      { x: clamped.clampedX, y: containerPosition.y },
      nextPosition.placement,
      false
    );
    correctToolbarToContentBounds(selectionToolbarElement, clamped.clampedX);
    correctSubmenusToContentBounds(selectionToolbarElement);
  };

  const resolveDisplayedToolbarPosition = (args: {
    pluginState: FloatingToolbarState;
    isReviewModeActive: boolean;
    selection: TextSelection;
  }) => {
    const { pluginState, isReviewModeActive, selection } = args;
    const reviewRange = isReviewModeActive && pluginState.aiReview
      ? {
          from: pluginState.aiReview.from,
          to: pluginState.aiReview.to,
        }
      : null;
    const aiPosition = reviewRange
      ? calculateBottomPositionForRange(editorView, reviewRange.from, reviewRange.to)
      : calculateBottomPosition(editorView);
    const selectionPosition = reviewRange
      ? calculatePositionForRange(editorView, reviewRange.from, reviewRange.to)
      : calculatePosition(editorView);
    const layout = getContentLayoutContext(
      editorView,
      positionRoot instanceof HTMLElement ? positionRoot : null
    );
    const nextPosition = resolveToolbarViewportPosition({
      aiPosition,
      layout,
      pluginState,
      selectionPosition,
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

  const getReviewRenderState = (
    review: NonNullable<FloatingToolbarState['aiReview']>,
    reviewWidth: number | null
  ) => [
    'aiReview',
    review.requestKey,
    reviewWidth === null ? '' : reviewWidth,
    review.from,
    review.to,
    review.instruction || '',
    review.commandId || '',
    review.toneId || '',
    review.originalText || '',
    review.suggestedText || '',
    review.errorMessage || '',
    review.isLoading ? 'loading' : '',
  ].join('|');

  const renderReviewToolbars = (
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
    const reviews = pluginState.aiReviews.length > 0
      ? pluginState.aiReviews
      : pluginState.aiReview
        ? [pluginState.aiReview]
        : [];
    const liveKeys = new Set(reviews.map((review) => review.requestKey));
    Array.from(reviewToolbars.keys()).forEach((requestKey) => {
      if (!liveKeys.has(requestKey)) {
        destroyReviewToolbar(requestKey);
      }
    });

    reviews.forEach((review) => {
      const entry = getReviewToolbar(review.requestKey);
      const blockElement = getBlockElementAtPos(editorView, review.from);
      const reviewWidth = blockElement
        ? Math.round(blockElement.getBoundingClientRect().width)
        : null;
      if (blockElement) {
        entry.element.style.setProperty(
          '--ai-review-width',
          `${reviewWidth}px`
        );
      } else {
        entry.element.style.removeProperty('--ai-review-width');
      }

      const reviewState: FloatingToolbarState = {
        ...pluginState,
        subMenu: 'aiReview',
        aiReview: review,
        isVisible: true,
      };
      const renderState = getReviewRenderState(review, reviewWidth);
      if (entry.lastRenderState !== renderState) {
        entry.lastRenderState = renderState;
        entry.renderer.render(editorView, {
          ...reviewState,
          ...toolbarState,
        });
      }

      const reviewRange = {
        from: review.from,
        to: review.to,
      };
      const aiPosition = calculateBottomPositionForRange(editorView, reviewRange.from, reviewRange.to);
      const selectionPosition = calculatePositionForRange(editorView, reviewRange.from, reviewRange.to);
      const layout = getContentLayoutContext(
        editorView,
        positionRoot instanceof HTMLElement ? positionRoot : null
      );
      const nextPosition = resolveToolbarViewportPosition({
        aiPosition,
        layout,
        pluginState: reviewState,
        selectionPosition,
      });
      const containerPosition = resolveToolbarContainerPosition(
        reviewState,
        nextPosition,
        positionRoot instanceof HTMLElement ? positionRoot : null
      );

      showToolbar(
        entry.element,
        { x: containerPosition.x, y: containerPosition.y },
        nextPosition.placement,
        true
      );
      correctSubmenusToContentBounds(entry.element);
    });
  };

  const updateToolbar = () => {
    const pluginState = toolbarKey.getState(editorView.state);
    const hasReviewPanels = Boolean(pluginState && (pluginState.aiReviews.length > 0 || pluginState.aiReview));
    const isReviewModeActive = pluginState?.subMenu === 'aiReview' && Boolean(pluginState.aiReview);
    ensureToolbarParent(isReviewModeActive);
    let { selection } = editorView.state;

    if (isFloatingToolbarSuppressed()) {
      hideToolbarAndReset();
      return;
    }

    if (!pluginState?.isVisible && !hasReviewPanels) {
      hideToolbarAndReset();
      return;
    }

    if (!pluginState) {
      hideToolbarAndReset();
      return;
    }

    if (!hasReviewPanels && !isReviewModeActive && (selection.empty || !(selection instanceof TextSelection))) {
      if (restoreSelectionForToolbar()) {
        selection = editorView.state.selection;
      }
    }

    if (!hasReviewPanels && !isReviewModeActive && (selection.empty || !(selection instanceof TextSelection))) {
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
    const toolbarState = {
      activeMarks,
      currentBlockType,
      currentAlignment,
      linkUrl,
      textColor,
      bgColor,
    };

    if (hasReviewPanels) {
      renderReviewToolbars(pluginState, toolbarState);
      hideToolbar(toolbarElement);
      lastRenderState = '';
      updateSelectionToolbarForReview(pluginState, toolbarState, selection);
      return;
    }

    reviewToolbars.forEach((_, requestKey) => destroyReviewToolbar(requestKey));

    renderToolbarIfNeeded(pluginState, toolbarState);

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
      : correctToolbarToContentBounds(toolbarElement, finalX);
    correctSubmenusToContentBounds(toolbarElement);
    updateSelectionToolbarForReview(pluginState, {
      activeMarks,
      currentBlockType,
      currentAlignment,
      linkUrl,
      textColor,
      bgColor,
    }, selection);

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
      const pluginState = toolbarKey.getState(editorView.state);
      if (pluginState?.subMenu === 'aiReview' && pluginState.aiReview) {
        return;
      }
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
    const pluginState = toolbarKey.getState(editorView.state);
    if (pluginState?.subMenu === 'aiReview' && pluginState.aiReview) {
      return;
    }

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
    if (
      !toolbarElement ||
      toolbarElement.contains(event.target as Node) ||
      selectionToolbarElement.contains(event.target as Node)
    ) {
      return;
    }

    const pluginState = toolbarKey.getState(editorView.state);
    if (pluginState?.subMenu === 'aiReview') {
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

    if (pluginState.subMenu === 'aiReview' && pluginState.aiReview) {
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
      if (pendingRaf !== null) {
        cancelAnimationFrame(pendingRaf);
      }
      if (layoutRaf !== null) {
        cancelAnimationFrame(layoutRaf);
      }

      unbindGlobalListeners(resizeObserver);
      toolbarRenderer.destroy();
      selectionToolbarRenderer.destroy();
      reviewToolbars.forEach(({ renderer, element }) => {
        renderer.destroy();
        element.remove();
      });
      reviewToolbars.clear();
      toolbarElement.remove();
      selectionToolbarElement.remove();
      resetToolbarTracking();
      interactionState.isPointerInsideToolbar = false;
      interactionState.isMouseDown = false;
      interactionState.pendingShow = false;
    },
  };
}
