import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAiReviewPanelController } from './AiReviewPanel';
import type { FloatingToolbarState } from '../types';

const mocks = vi.hoisted(() => ({
  bindAiReviewActions: vi.fn(() => vi.fn()),
  errorBlock: vi.fn(),
  floatingToolbarGetState: vi.fn(() => null),
}));

vi.mock('@/components/Chat/features/Messages/components/ErrorBlock', () => ({
  ErrorBlock: (props: {
    content: string;
    showLoginPrompt?: boolean;
  }) => {
    mocks.errorBlock(props);
    return <div data-testid="chat-error-block">{props.content}</div>;
  },
}));

vi.mock('@/components/Chat/features/Messages/components/ChatLoading', () => ({
  ChatLoading: () => <div data-testid="chat-loading" />,
}));

vi.mock('./AiToolbarModelSelector', () => ({
  AiToolbarModelSelector: () => <div data-testid="ai-model-selector" />,
}));

vi.mock('./ai-review/reviewBindings', () => ({
  bindAiReviewActions: () => mocks.bindAiReviewActions(),
}));

vi.mock('../floatingToolbarKey', () => ({
  floatingToolbarKey: {
    getState: () => mocks.floatingToolbarGetState(),
  },
}));

vi.mock('../ai/reviewFlow', () => ({
  runAiSelectionReviewCommand: vi.fn(),
}));

function createState(reviewOverrides: Partial<NonNullable<FloatingToolbarState['aiReview']>>): FloatingToolbarState {
  return {
    isVisible: true,
    position: { x: 0, y: 0 },
    placement: 'top',
    dragPosition: null,
    activeMarks: new Set(),
    currentBlockType: 'paragraph',
    currentAlignment: 'left',
    copied: false,
    linkUrl: null,
    textColor: null,
    bgColor: null,
    selectionRange: null,
    subMenu: 'aiReview',
    aiReview: {
      requestKey: 'review-1',
      instruction: 'Rewrite',
      commandId: 'rewrite',
      toneId: null,
      from: 1,
      to: 2,
      originalText: 'old',
      suggestedText: '',
      isLoading: false,
      errorMessage: 'Request failed.',
      ...reviewOverrides,
    },
    aiReviews: [],
  };
}

function createContainer(): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="ai-review-model-selector-slot"></div>
    <div class="ai-review-error-slot"></div>
    <div class="ai-review-panel">
      <button type="button" data-review-action="cancel"></button>
      <button type="button" data-review-action="accept"></button>
    </div>
  `;
  document.body.append(container);
  return container;
}

describe('AiReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it('renders normal AI review errors with the shared chat ErrorBlock', async () => {
    const controller = createAiReviewPanelController();
    const container = createContainer();

    await act(async () => {
      controller.render(container, {} as never, createState({ errorMessage: 'Model request failed.' }), vi.fn());
    });

    expect(screen.getByTestId('chat-error-block')).toHaveTextContent('Model request failed.');
    expect(mocks.errorBlock).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Model request failed.',
      showLoginPrompt: false,
    }));

    await act(async () => {
      controller.destroy();
    });
  });

  it('passes auth and quota review errors through the shared chat ErrorBlock prompts', async () => {
    const controller = createAiReviewPanelController();
    const container = createContainer();

    await act(async () => {
      controller.render(container, {} as never, createState({
        errorMessage: 'Sign in required.',
        errorType: 'AUTH_ERROR',
      }), vi.fn());
    });

    expect(mocks.errorBlock).toHaveBeenLastCalledWith(expect.objectContaining({
      content: 'Sign in required.',
      showLoginPrompt: true,
    }));

    await act(async () => {
      controller.render(container, {} as never, createState({
        errorMessage: 'Quota exhausted.',
        errorType: 'QUOTA_EXHAUSTED',
      }), vi.fn());
    });

    expect(mocks.errorBlock).toHaveBeenLastCalledWith(expect.objectContaining({
      content: 'Quota exhausted.',
      showLoginPrompt: false,
    }));

    await act(async () => {
      controller.destroy();
    });
  });
});
