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


export function installFloatingToolbarPluginViewToolbarRenderMethods(ctx: FloatingToolbarPluginViewContext): void {
  ctx.renderToolbarIfNeeded = (
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
          pluginState.aiReview.errorType || '',
          pluginState.aiReview.errorCode || '',
          pluginState.aiReview.isLoading ? 'loading' : '',
        ].join('|')
      : [
          Array.from(toolbarState.activeMarks).sort().join(','),
          toolbarState.currentBlockType,
          toolbarState.currentAlignment,
          toolbarState.linkUrl || '',
          toolbarState.textColor || '',
          toolbarState.bgColor || '',
          pluginState.selectionRange ? `${pluginState.selectionRange.from}:${pluginState.selectionRange.to}` : '',
          pluginState.copied ? 'copied' : '',
          pluginState.subMenu || '',
        ].join('|');

    if (cacheKey === ctx.lastRenderState) {
      return;
    }

    ctx.lastRenderState = cacheKey;
    ctx.toolbarRenderer.render(ctx.editorView, {
      ...pluginState,
      ...toolbarState,
    });
  };

  ctx.updateSelectionToolbarForReview = (
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
      if (
        ctx.selectionToolbarSubMenu === null &&
        ctx.lastSelectionToolbarRenderState === '' &&
        !ctx.selectionToolbarElement.classList.contains('visible')
      ) {
        return;
      }

      hideToolbar(ctx.selectionToolbarElement);
      ctx.lastSelectionToolbarRenderState = '';
      ctx.selectionToolbarSubMenu = null;
      return;
    }

    const selectionState: FloatingToolbarState = {
      ...pluginState,
      subMenu: ctx.selectionToolbarSubMenu,
      aiReview: null,
      dragPosition: null,
      isVisible: true,
      copied: false,
    };
    const renderState = [
      selection.from,
      selection.to,
      ctx.selectionToolbarSubMenu || '',
      Array.from(toolbarState.activeMarks).sort().join(','),
      toolbarState.currentBlockType,
      toolbarState.currentAlignment,
      toolbarState.linkUrl || '',
      toolbarState.textColor || '',
      toolbarState.bgColor || '',
    ].join('|');

    if (renderState !== ctx.lastSelectionToolbarRenderState) {
      ctx.lastSelectionToolbarRenderState = renderState;
      ctx.selectionToolbarRenderer.render(ctx.editorView, {
        ...selectionState,
        ...toolbarState,
      });
    }

    const layout = getContentLayoutContext(
      ctx.editorView,
      ctx.positionRoot instanceof HTMLElement ? ctx.positionRoot : null
    );
    const nextPosition = calculatePosition(ctx.editorView);
    const containerPosition = resolveToolbarContainerPosition(
      selectionState,
      nextPosition,
      ctx.positionRoot instanceof HTMLElement ? ctx.positionRoot : null
    );
    const clamped = clampToolbarX(
      containerPosition.x,
      ctx.positionRoot instanceof HTMLElement ? ctx.positionRoot : null,
      false,
      ctx.selectionToolbarElement,
      layout.containerBounds
    );

    showToolbar(
      ctx.selectionToolbarElement,
      { x: clamped.clampedX, y: containerPosition.y },
      nextPosition.placement,
      false
    );
    ctx.correctToolbarToViewportYBounds(ctx.selectionToolbarElement, containerPosition.y);
    ctx.correctToolbarToContentBounds(ctx.selectionToolbarElement, clamped.clampedX);
    ctx.correctSubmenusToContentBounds(ctx.selectionToolbarElement);
  };
}
