import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { createToolbarRenderer } from './renderToolbar';
import {
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
import {
  clampToolbarX,
  correctToolbarYToViewportBounds,
  createToolbarElement,
  hideToolbar,
  isFloatingToolbarSuppressed,
  showToolbar,
} from './floatingToolbarDom';
import {
  getContentLayoutContext,
  getAiReviewPanelWidth,
  resolveToolbarContainerPosition,
  resolveToolbarViewportPosition,
} from './floatingToolbarLayout';
import { clearFormatPreview, hasActiveAppliedPreview } from './previewStyles';
import { hasUsableTextRange, hasUsableTextSelection } from './selectionValidity';
import { correctToolbarSubmenusToContentBounds } from './floatingToolbarSubmenus';
import { toggleMark, setLink } from './commands';
import { openLinkTooltipFromSelection } from './linkTooltipActions';
import { abortActiveAiSelectionReview } from './ai/reviewAbort';
import type { FloatingToolbarPluginViewContext } from './floatingToolbarPluginViewTypes';
import {
  hasVisibleNativeRange,
  isDocumentFormatShortcut,
  isEditableShortcutTarget,
  shouldLockPreviewToolbarPosition,
} from './floatingToolbarPluginViewUtils';

export function installFloatingToolbarPluginViewLayoutMethods(ctx: FloatingToolbarPluginViewContext): void {
  ctx.correctToolbarToContentBounds = (toolbar: HTMLElement, x: number) => {
    const container = ctx.positionRoot instanceof HTMLElement ? ctx.positionRoot : null;
    if (!container) {
      return x;
    }

    const layout = getContentLayoutContext(ctx.editorView, container);
    return ctx.correctToolbarToLayoutBounds(toolbar, x, layout.viewportBounds);
  };

  ctx.correctToolbarToLayoutBounds = (
    toolbar: HTMLElement,
    x: number,
    bounds: { left: number; right: number }
  ) => {
    const contentLeft = bounds.left;
    const contentRight = bounds.right;
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

  ctx.correctToolbarToViewportYBounds = (toolbar: HTMLElement, y: number) => {
    const containerRect = ctx.positionRoot instanceof HTMLElement
      ? ctx.positionRoot.getBoundingClientRect()
      : null;
    const viewportTop = typeof window === 'undefined' ? 0 : 0;
    const viewportBottom = typeof window === 'undefined'
      ? Number.POSITIVE_INFINITY
      : window.innerHeight;
    const bounds = containerRect
      ? {
          top: Math.max(viewportTop, containerRect.top),
          bottom: Math.min(viewportBottom, containerRect.bottom),
        }
      : {
          top: viewportTop,
          bottom: viewportBottom,
        };

    return correctToolbarYToViewportBounds(toolbar, y, bounds);
  };

  ctx.correctSubmenusToContentBounds = (toolbar: HTMLElement) => {
    const layout = getContentLayoutContext(ctx.editorView, ctx.positionRoot instanceof HTMLElement ? ctx.positionRoot : null);
    const contentLeft = layout.viewportBounds.left;
    const contentRight = layout.viewportBounds.right;

    correctToolbarSubmenusToContentBounds(toolbar, { left: contentLeft, right: contentRight });
  };

  ctx.syncAiReviewWidth = (
    isReviewModeActive: boolean,
    _pluginState: FloatingToolbarState | undefined
  ) => {
    if (!isReviewModeActive) {
      if (ctx.hasAiReviewWidthStyle) {
        ctx.toolbarElement.style.removeProperty('--vlaina-toolbar-ai-review-width');
        ctx.hasAiReviewWidthStyle = false;
      }
      return;
    }

    const aiReviewWidth = getAiReviewPanelWidth(
      getContentLayoutContext(ctx.editorView, ctx.positionRoot instanceof HTMLElement ? ctx.positionRoot : null)
    );
    if (isReviewModeActive && aiReviewWidth > 0) {
      ctx.toolbarElement.style.setProperty(
        '--vlaina-toolbar-ai-review-width',
        `${Math.round(aiReviewWidth)}px`
      );
      ctx.hasAiReviewWidthStyle = true;
      return;
    }

    if (ctx.hasAiReviewWidthStyle) {
      ctx.toolbarElement.style.removeProperty('--vlaina-toolbar-ai-review-width');
      ctx.hasAiReviewWidthStyle = false;
    }
  };

  ctx.resolveDisplayedToolbarPosition = (args: {
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
    const selectionPosition = reviewRange
      ? calculatePositionForRange(ctx.editorView, reviewRange.from, reviewRange.to)
      : calculatePosition(ctx.editorView);
    const layout = getContentLayoutContext(
      ctx.editorView,
      ctx.positionRoot instanceof HTMLElement ? ctx.positionRoot : null
    );
    const aiPosition = reviewRange
      ? calculateBottomPositionForRange(ctx.editorView, reviewRange.from, reviewRange.to)
      : selectionPosition;
    const nextPosition = resolveToolbarViewportPosition({
      aiPosition,
      layout,
      pluginState,
      selectionPosition,
    });

    const containerPosition = resolveToolbarContainerPosition(
      pluginState,
      nextPosition,
      ctx.positionRoot instanceof HTMLElement ? ctx.positionRoot : null
    );

    const isAiMode = pluginState.subMenu === 'ai' || pluginState.subMenu === 'aiReview';
    const containerWidth = ctx.positionRoot instanceof HTMLElement ? ctx.positionRoot.clientWidth : null;
    const currentScrollLeft = ctx.scrollRoot?.scrollLeft ?? 0;
    const currentScrollTop = ctx.scrollRoot?.scrollTop ?? 0;
    const selectionSignature = isReviewModeActive && pluginState.aiReview
      ? `${pluginState.aiReview.from}:${pluginState.aiReview.to}`
      : `${selection.from}:${selection.to}`;
    const clamped = clampToolbarX(
      containerPosition.x,
      ctx.positionRoot instanceof HTMLElement ? ctx.positionRoot : null,
      isAiMode,
      ctx.toolbarElement,
      layout.containerBounds,
      ctx.lastMeasuredToolbarWidth
    );
    const shouldFreezeX =
      pluginState.subMenu !== 'aiReview' &&
      ctx.lastToolbarX !== null &&
      ctx.lastSelectionSignature === selectionSignature &&
      ctx.lastContainerWidth === containerWidth;
    const shouldFreezePreviewToolbarPosition =
      shouldLockPreviewToolbarPosition({
        subMenu: pluginState.subMenu,
        hasActivePreview: hasActiveAppliedPreview(ctx.editorView),
      }) &&
      ctx.lastToolbarX !== null &&
      ctx.lastToolbarY !== null &&
      ctx.lastToolbarPlacement !== null &&
      ctx.lastScrollLeft === currentScrollLeft &&
      ctx.lastScrollTop === currentScrollTop &&
      ctx.lastSelectionSignature === selectionSignature &&
      ctx.lastContainerWidth === containerWidth;
    const shouldFreezeHoveredToolbarPosition =
      ctx.interactionState.isPointerInsideToolbar &&
      pluginState.subMenu !== 'aiReview' &&
      ctx.lastToolbarX !== null &&
      ctx.lastToolbarY !== null &&
      ctx.lastToolbarPlacement !== null &&
      ctx.lastSelectionSignature === selectionSignature &&
      ctx.lastContainerWidth === containerWidth;
    const finalX =
      shouldFreezeHoveredToolbarPosition && ctx.lastToolbarX !== null
        ? ctx.lastToolbarX
        : shouldFreezePreviewToolbarPosition && ctx.lastToolbarX !== null
          ? ctx.lastToolbarX
          : shouldFreezeX && ctx.lastToolbarX !== null
            ? ctx.lastToolbarX
            : clamped.clampedX;
    const finalY =
      shouldFreezeHoveredToolbarPosition && ctx.lastToolbarY !== null
        ? ctx.lastToolbarY
        : shouldFreezePreviewToolbarPosition && ctx.lastToolbarY !== null
          ? ctx.lastToolbarY
          : containerPosition.y;
    const finalPlacement =
      shouldFreezeHoveredToolbarPosition && ctx.lastToolbarPlacement !== null
        ? ctx.lastToolbarPlacement
        : shouldFreezePreviewToolbarPosition && ctx.lastToolbarPlacement !== null
          ? ctx.lastToolbarPlacement
          : nextPosition.placement;

    return {
      containerWidth,
      finalPlacement,
      finalX,
      finalY,
      layoutViewportBounds: layout.viewportBounds,
      currentScrollLeft,
      currentScrollTop,
      selectionSignature,
    };
  };

}
