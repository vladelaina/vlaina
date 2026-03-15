import { TextSelection, type PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
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
  showToolbar,
  toContainerPosition,
} from './floatingToolbarDom';

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
  let lastContainerWidth: number | null = null;
  let lastPlacement: 'top' | 'bottom' | null = null;
  let lastTextSelection: { from: number; to: number } | null = null;

  const toolbarElement = createToolbarElement();
  const toolbarRenderer = createToolbarRenderer(toolbarElement);
  const scrollRoot = getScrollRoot(editorView);
  const toolbarRoot = getToolbarRoot(editorView);
  (toolbarRoot ?? scrollRoot ?? document.body).appendChild(toolbarElement);

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

  const updateToolbar = () => {
    const pluginState = toolbarKey.getState(editorView.state);
    const isReviewModeActive = pluginState?.subMenu === 'aiReview' && Boolean(pluginState.aiReview);
    let { selection } = editorView.state;

    if (!isReviewModeActive && (selection.empty || !(selection instanceof TextSelection))) {
      if (restoreSelectionForToolbar()) {
        selection = editorView.state.selection;
      }
    }

    if (!isReviewModeActive && (selection.empty || !(selection instanceof TextSelection))) {
      hideToolbar(toolbarElement);
      lastRenderState = '';
      currentBlockElement = null;
      lastSelectionSignature = '';
      lastToolbarX = null;
      lastToolbarY = null;
      lastContainerWidth = null;
      lastPlacement = null;
      return;
    }

    currentBlockElement = isReviewModeActive && pluginState?.aiReview
      ? getBlockElementAtPos(editorView, pluginState.aiReview.from)
      : getCurrentBlockElement(editorView);

    if (!pluginState?.isVisible) {
      hideToolbar(toolbarElement);
      lastRenderState = '';
      lastSelectionSignature = '';
      lastToolbarX = null;
      lastToolbarY = null;
      lastContainerWidth = null;
      lastPlacement = null;
      return;
    }

    const aiPosition = calculateBottomPosition(editorView);
    const nextPosition = pluginState.dragPosition && pluginState.subMenu === 'aiReview'
      ? {
          x: pluginState.dragPosition.x,
          y: pluginState.dragPosition.y,
          placement: 'bottom' as const,
        }
      : pluginState.subMenu === 'ai' || pluginState.subMenu === 'aiReview'
        ? {
            ...aiPosition,
            x: currentBlockElement?.getBoundingClientRect().left ?? aiPosition.x,
          }
        : calculatePosition(editorView);

    const containerPosition = pluginState.dragPosition && pluginState.subMenu === 'aiReview'
      ? {
          x: pluginState.dragPosition.x,
          y: pluginState.dragPosition.y,
        }
      : toContainerPosition(nextPosition, toolbarRoot ?? scrollRoot);

    const activeMarks = getActiveMarks(editorView);
    const currentBlockType = getCurrentBlockType(editorView);
    const currentAlignment = getCurrentAlignment(editorView);
    const linkUrl = getLinkUrl(editorView);
    const textColor = getTextColor(editorView);
    const bgColor = getBgColor(editorView);
    const cacheKey = [
      Array.from(activeMarks).sort().join(','),
      currentBlockType,
      currentAlignment,
      linkUrl || '',
      textColor || '',
      bgColor || '',
      pluginState.copied ? 'copied' : '',
      pluginState.subMenu || '',
      pluginState.aiReview?.instruction || '',
      pluginState.aiReview?.originalText || '',
      pluginState.aiReview?.suggestedText || '',
      pluginState.aiReview?.customPrompt || '',
      pluginState.aiReview?.isLoading ? 'loading' : '',
    ].join('|');

    if (cacheKey !== lastRenderState) {
      lastRenderState = cacheKey;
      toolbarRenderer.render(editorView, {
        ...pluginState,
        activeMarks,
        currentBlockType,
        currentAlignment,
        linkUrl,
        textColor,
        bgColor,
      });
    }

    const isAiMode = pluginState.subMenu === 'ai' || pluginState.subMenu === 'aiReview';
    const containerWidth = (toolbarRoot ?? scrollRoot)?.clientWidth ?? null;
    const selectionSignature = isReviewModeActive && pluginState.aiReview
      ? `${pluginState.aiReview.from}:${pluginState.aiReview.to}`
      : `${selection.from}:${selection.to}`;
    const clamped = clampToolbarX(
      containerPosition.x,
      toolbarRoot ?? scrollRoot,
      isAiMode,
      toolbarElement
    );
    const shouldFreezeX =
      !isAiMode &&
      lastToolbarX !== null &&
      lastSelectionSignature === selectionSignature &&
      lastContainerWidth === containerWidth;
    const shouldFreezePosition =
      shouldFreezeX &&
      pluginState.subMenu !== null &&
      lastToolbarY !== null &&
      lastPlacement !== null;
    const finalX = shouldFreezeX && lastToolbarX !== null ? lastToolbarX : clamped.clampedX;
    const finalY =
      shouldFreezePosition && lastToolbarY !== null ? lastToolbarY : containerPosition.y;
    const finalPlacement =
      shouldFreezePosition && lastPlacement !== null ? lastPlacement : nextPosition.placement;

    showToolbar(
      toolbarElement,
      { x: finalX, y: finalY },
      finalPlacement,
      pluginState.subMenu === 'aiReview'
    );

    lastSelectionSignature = selectionSignature;
    lastToolbarX = finalX;
    lastToolbarY = finalY;
    lastContainerWidth = containerWidth;
    lastPlacement = finalPlacement;
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

  const handleMouseDown = () => {
    interactionState.isMouseDown = true;
    interactionState.pendingShow = false;
  };

  const handleMouseUp = () => {
    interactionState.isMouseDown = false;
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
      editorView.dispatch(
        editorView.state.tr.setMeta(toolbarKey, {
          type: TOOLBAR_ACTIONS.CLEAR_AI_REVIEW,
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

  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('mousedown', handleClickOutside);
  document.addEventListener('keydown', handleEscape);
  toolbarElement.addEventListener('mouseenter', handleToolbarPointerEnter);
  toolbarElement.addEventListener('mouseleave', handleToolbarPointerLeave);
  window.addEventListener('resize', scheduleToolbarUpdate);
  scrollRoot?.addEventListener('scroll', scheduleToolbarUpdate, { passive: true });
  resizeObserver?.observe(editorView.dom);
  if (scrollRoot) {
    resizeObserver?.observe(scrollRoot);
  }
  if (toolbarRoot && toolbarRoot !== scrollRoot) {
    resizeObserver?.observe(toolbarRoot);
  }

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

      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      toolbarElement.removeEventListener('mouseenter', handleToolbarPointerEnter);
      toolbarElement.removeEventListener('mouseleave', handleToolbarPointerLeave);
      window.removeEventListener('resize', scheduleToolbarUpdate);
      scrollRoot?.removeEventListener('scroll', scheduleToolbarUpdate);
      resizeObserver?.disconnect();
      toolbarRenderer.destroy();
      toolbarElement.remove();
      currentBlockElement = null;
      lastRenderState = '';
      lastSelectionSignature = '';
      lastToolbarX = null;
      lastToolbarY = null;
      lastContainerWidth = null;
      lastPlacement = null;
      interactionState.isPointerInsideToolbar = false;
      lastTextSelection = null;
      interactionState.isMouseDown = false;
      interactionState.pendingShow = false;
    },
  };
}
