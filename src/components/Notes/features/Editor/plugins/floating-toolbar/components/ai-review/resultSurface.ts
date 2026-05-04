import type { EditorView } from '@milkdown/kit/prose/view';
import {
  measureTextBlockHeight,
  resolveElementTextLayoutMetrics,
} from '@/lib/text-layout';
import { renderAppliedPreviewDocument } from '../../appliedPreviewState';
import { createAppliedAiSelectionPreviewState } from '../../ai/selectionEditing';
import type { AiSelectionSuggestion } from '../../ai/selectionCommandTypes';

const AI_REVIEW_RESULT_MAX_HEIGHT = 320;
const AI_REVIEW_RESULT_MIN_HEIGHT = 48;
const AI_REVIEW_RESULT_HEIGHT_VAR = '--ai-review-result-predicted-height';

function parsePixelValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function clearResultSurfacePredictedHeight(element: HTMLElement): void {
  element.style.removeProperty(AI_REVIEW_RESULT_HEIGHT_VAR);
}

function renderResultSurfaceStaleState(element: HTMLElement) {
  clearResultSurfacePredictedHeight(element);
  const alert = element.ownerDocument.createElement('div');
  alert.className = 'ai-review-error';
  alert.setAttribute('role', 'alert');
  alert.textContent = 'The selected text changed before the AI result could be previewed.';
  element.replaceChildren(alert);
}

function reservePredictedResultHeight(element: HTMLElement, text: string): void {
  try {
    const computedStyle = window.getComputedStyle(element);
    const inlinePadding =
      parsePixelValue(computedStyle.paddingLeft) + parsePixelValue(computedStyle.paddingRight);
    const width = Math.max(1, element.clientWidth - inlinePadding);
    const metrics = resolveElementTextLayoutMetrics(element);
    const predictedHeight = measureTextBlockHeight(text, width, {
      font: metrics.font,
      lineHeight: metrics.lineHeight,
      minHeight: AI_REVIEW_RESULT_MIN_HEIGHT,
      maxHeight: AI_REVIEW_RESULT_MAX_HEIGHT,
      prepareOptions: {
        whiteSpace: 'pre-wrap',
      },
    });

    element.style.setProperty(AI_REVIEW_RESULT_HEIGHT_VAR, `${predictedHeight}px`);
  } catch {
    clearResultSurfacePredictedHeight(element);
  }
}

export function renderResultSurfaceAppliedPreview(
  element: HTMLElement,
  view: EditorView,
  suggestion: AiSelectionSuggestion
) {
  const previewState = createAppliedAiSelectionPreviewState(view, suggestion);
  if (!previewState) {
    renderResultSurfaceStaleState(element);
    return;
  }

  reservePredictedResultHeight(element, suggestion.suggestedText);

  const previewDom = renderAppliedPreviewDocument(
    previewState,
    view.dom instanceof HTMLElement ? view.dom : null,
    element.ownerDocument,
    'ai-review-applied-preview'
  );

  element.replaceChildren(previewDom);
}
