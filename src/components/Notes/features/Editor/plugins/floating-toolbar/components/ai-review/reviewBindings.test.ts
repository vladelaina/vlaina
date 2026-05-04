import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { bindAiReviewActions } from './reviewBindings';
import type { AiReviewElements } from './reviewDom';

const applyAiSelectionSuggestion = vi.fn();
const retryAiSelectionSuggestionResult = vi.fn();
const syncReviewUi = vi.fn();
const mockGetFloatingToolbarState = vi.fn();

vi.mock('../../ai/selectionCommands', () => ({
  applyAiSelectionSuggestion: (...args: unknown[]) => applyAiSelectionSuggestion(...args),
  retryAiSelectionSuggestionResult: (...args: unknown[]) => retryAiSelectionSuggestionResult(...args),
}));

vi.mock('./reviewState', () => ({
  toAiSelectionSuggestion: vi.fn((review) => review),
}));

vi.mock('./reviewUi', () => ({
  stopPassiveReviewMouseDown: vi.fn(),
  stopReviewMouseDown: vi.fn(),
  syncReviewUi: (...args: unknown[]) => syncReviewUi(...args),
}));

vi.mock('../../floatingToolbarKey', () => ({
  floatingToolbarKey: {
    getState: (...args: unknown[]) => mockGetFloatingToolbarState(...args),
  },
}));

function createElements(): AiReviewElements {
  const panel = document.createElement('div');
  panel.className = 'ai-review-panel';
  panel.tabIndex = -1;

  const acceptButton = document.createElement('button');
  const cancelButton = document.createElement('button');
  const retryButton = document.createElement('button');

  panel.appendChild(acceptButton);
  panel.appendChild(cancelButton);
  panel.appendChild(retryButton);
  document.body.appendChild(panel);

  return {
    panel,
    acceptButton,
    cancelButton,
    retryButton,
  };
}

function createView(): EditorView {
  return {} as EditorView;
}

describe('bindAiReviewActions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    applyAiSelectionSuggestion.mockReset();
    applyAiSelectionSuggestion.mockReturnValue(true);
    retryAiSelectionSuggestionResult.mockReset();
    syncReviewUi.mockReset();
    mockGetFloatingToolbarState.mockReset();
  });

  it('focuses the panel and applies on Enter', async () => {
    const elements = createElements();
    const onClose = vi.fn();

    bindAiReviewActions({
      elements,
      onClose,
      review: {
        requestKey: 'review-1',
        instruction: 'Translate to English',
        commandId: 'translate-en',
        toneId: null,
        from: 1,
        to: 4,
        originalText: '你好',
        suggestedText: 'Hello',
        isLoading: false,
        errorMessage: null,
      },
      updateReview: vi.fn(),
      view: createView(),
    });

    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(document.activeElement).toBe(elements.panel);

    elements.panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(applyAiSelectionSuggestion).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the panel open when applying the suggestion is rejected', async () => {
    applyAiSelectionSuggestion.mockReturnValue(false);
    const elements = createElements();
    const onClose = vi.fn();

    bindAiReviewActions({
      elements,
      onClose,
      review: {
        requestKey: 'review-1',
        instruction: 'Polish',
        commandId: 'polish',
        toneId: null,
        from: 1,
        to: 4,
        originalText: 'helo',
        suggestedText: 'hello',
        isLoading: false,
        errorMessage: null,
      },
      updateReview: vi.fn(),
      view: createView(),
    });

    elements.acceptButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(applyAiSelectionSuggestion).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not abort retry only because the panel binding is cleaned up during loading rerender', async () => {
    const elements = createElements();
    const cleanup = bindAiReviewActions({
      elements,
      onClose: vi.fn(),
      review: {
        requestKey: 'review-1',
        instruction: 'Polish',
        commandId: 'polish',
        toneId: null,
        from: 1,
        to: 4,
        originalText: 'helo',
        suggestedText: 'hello',
        isLoading: false,
        errorMessage: null,
      },
      updateReview: vi.fn(),
      view: createView(),
    });

    retryAiSelectionSuggestionResult.mockReturnValue(new Promise(() => {}));

    elements.retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    cleanup();

    expect(retryAiSelectionSuggestionResult).toHaveBeenCalledTimes(1);
    const [, signal] = retryAiSelectionSuggestionResult.mock.calls[0];
    expect(signal).toBeUndefined();
  });
});
