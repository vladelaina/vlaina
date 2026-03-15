export interface AiReviewElements {
  acceptButton: HTMLButtonElement;
  retryButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  closeButton: HTMLButtonElement | null;
  promptInput: HTMLInputElement | null;
  promptSubmitButton: HTMLButtonElement | null;
  dragHandle: HTMLElement;
  commandButtons: HTMLButtonElement[];
  toneButtons: HTMLButtonElement[];
}

export function getAiReviewElements(container: HTMLElement): AiReviewElements | null {
  const acceptButton = container.querySelector<HTMLButtonElement>('[data-review-action="accept"]');
  const retryButton = container.querySelector<HTMLButtonElement>('[data-review-action="retry"]');
  const cancelButton = container.querySelector<HTMLButtonElement>('[data-review-action="cancel"]');
  const closeButton = container.querySelector<HTMLButtonElement>('[data-review-action="close"]');
  const promptInput = container.querySelector<HTMLInputElement>('[data-review-prompt-input]');
  const promptSubmitButton = container.querySelector<HTMLButtonElement>(
    '[data-review-action="prompt-submit"]'
  );
  const dragHandle = container.querySelector<HTMLElement>('[data-review-drag-handle]');

  if (!acceptButton || !retryButton || !cancelButton || !dragHandle) {
    return null;
  }

  return {
    acceptButton,
    retryButton,
    cancelButton,
    closeButton,
    promptInput,
    promptSubmitButton,
    dragHandle,
    commandButtons: Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-review-command-id]')
    ),
    toneButtons: Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-review-tone-id]')
    ),
  };
}
