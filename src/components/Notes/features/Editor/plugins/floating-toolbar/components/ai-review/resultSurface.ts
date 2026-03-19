import { renderAiReviewDiffMarkup } from '../../ai/reviewDiff';

export function renderResultSurfacePreview(
  element: HTMLElement,
  previousText: string,
  nextText: string
) {
  element.innerHTML = renderAiReviewDiffMarkup(previousText, nextText);
}
