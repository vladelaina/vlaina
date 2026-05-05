import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { bindAiReviewActions } from './reviewBindings';
import type { AiReviewElements } from './reviewDom';

const applyAiSelectionSuggestion = vi.fn();
const retryAiSelectionSuggestionResult = vi.fn();
const syncReviewUi = vi.fn();
const mockGetFloatingToolbarState = vi.fn();
const mockCollapseSelectionAfterToolbarApply = vi.fn();

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

vi.mock('../../selectionCollapse', () => ({
  collapseSelectionAfterToolbarApply: (...args: unknown[]) => mockCollapseSelectionAfterToolbarApply(...args),
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
    mockCollapseSelectionAfterToolbarApply.mockReset();
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
    expect(mockCollapseSelectionAfterToolbarApply).toHaveBeenCalledTimes(1);
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
    expect(mockCollapseSelectionAfterToolbarApply).not.toHaveBeenCalled();
  });

  it('treats accept as close while the suggestion is still loading', () => {
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
        suggestedText: '',
        isLoading: true,
        errorMessage: null,
      },
      updateReview: vi.fn(),
      view: createView(),
    });

    elements.acceptButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(applyAiSelectionSuggestion).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockCollapseSelectionAfterToolbarApply).not.toHaveBeenCalled();
  });

  it('treats accept as close when no suggestion has been rendered yet', () => {
    const elements = createElements();
    const onClose = vi.fn();

    bindAiReviewActions({
      elements,
      onClose,
      review: {
        requestKey: 'review-1',
        instruction: null,
        commandId: null,
        toneId: null,
        from: 1,
        to: 4,
        originalText: 'helo',
        suggestedText: '',
        isLoading: false,
        errorMessage: null,
      },
      updateReview: vi.fn(),
      view: createView(),
    });

    elements.acceptButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(applyAiSelectionSuggestion).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockCollapseSelectionAfterToolbarApply).not.toHaveBeenCalled();
  });

  it('does not steal focus from another active editor control', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    const elements = createElements();

    bindAiReviewActions({
      elements,
      onClose: vi.fn(),
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

    expect(document.activeElement).toBe(input);
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

  it('updates the retried review even when another review is active', async () => {
    const elements = createElements();
    const updateReview = vi.fn();
    const review = {
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
    };
    const activeReview = {
      ...review,
      requestKey: 'review-2',
      from: 8,
      to: 12,
      originalText: 'bye',
      suggestedText: 'goodbye',
    };

    mockGetFloatingToolbarState.mockReturnValue({
      aiReview: activeReview,
      aiReviews: [review, activeReview],
    });
    retryAiSelectionSuggestionResult.mockResolvedValue({
      suggestion: {
        ...review,
        suggestedText: 'hello!',
      },
      errorMessage: null,
    });

    bindAiReviewActions({
      elements,
      onClose: vi.fn(),
      review,
      updateReview,
      view: createView(),
    });

    elements.retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(updateReview).toHaveBeenCalledWith({
      ...review,
      isLoading: true,
      errorMessage: null,
    });
    expect(updateReview).toHaveBeenLastCalledWith({
      ...review,
      suggestedText: 'hello!',
      isLoading: false,
      errorMessage: null,
    });
  });
});
