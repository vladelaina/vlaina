export interface AiReviewElements {
  panel: HTMLElement;
  acceptButton: HTMLButtonElement;
  retryButton: HTMLButtonElement | null;
  cancelButton: HTMLButtonElement;
  closeButton: HTMLButtonElement | null;
}

export function getAiReviewElements(container: HTMLElement): AiReviewElements | null {
  const panel = container.querySelector<HTMLElement>('.ai-review-panel');
  const acceptButton = container.querySelector<HTMLButtonElement>('[data-review-action="accept"]');
  const retryButton = container.querySelector<HTMLButtonElement>('[data-review-action="retry"]');
  const cancelButton = container.querySelector<HTMLButtonElement>('[data-review-action="cancel"]');
  const closeButton = container.querySelector<HTMLButtonElement>('[data-review-action="close"]');

  if (!panel || !acceptButton || !cancelButton) {
    return null;
  }

  return {
    panel,
    acceptButton,
    retryButton,
    cancelButton,
    closeButton,
  };
}
