import type { FloatingToolbarState } from './types';
import { renderAiReviewMarkup } from './ai/renderAiReviewMarkup';
import { renderToolbarBodyMarkup } from './toolbarBaseMarkup';

export function renderToolbarMarkup(state: FloatingToolbarState): string {
  const aiReviewMarkup = renderAiReviewMarkup(state);
  if (aiReviewMarkup) {
    return aiReviewMarkup;
  }

  return renderToolbarBodyMarkup(state);
}
