import { beforeEach, describe, expect, it } from 'vitest';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { renderToolbarMarkup } from './toolbarMarkup';
import type { FloatingToolbarState } from './types';

function createState(overrides?: Partial<FloatingToolbarState>): FloatingToolbarState {
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
    subMenu: null,
    aiReview: null,
    aiReviews: [],
    ...overrides,
  };
}

describe('toolbar markup', () => {
  beforeEach(() => {
    useAccountSessionStore.setState({ isConnected: true });
    useUnifiedStore.setState((state) => ({
      data: {
        ...state.data,
        ai: {
          ...state.data.ai!,
          providers: [],
        },
      },
    }));
  });

  it('renders a reduced toolbar for code blocks', () => {
    const markup = renderToolbarMarkup(createState({ currentBlockType: 'codeBlock' }));

    expect(markup).toContain('data-action="ai"');
    expect(markup).toContain('data-action="block"');
    expect(markup).toContain('data-action="copy"');
    expect(markup).toContain('data-action="delete"');
    expect(markup).not.toContain('data-action="alignment"');
    expect(markup).not.toContain('data-action="bold"');
    expect(markup).not.toContain('data-action="italic"');
    expect(markup).not.toContain('data-action="link"');
    expect(markup).not.toContain('data-action="color"');
  });

  it('hides AI tools when no account or custom provider is available', () => {
    useAccountSessionStore.setState({ isConnected: false });

    const markup = renderToolbarMarkup(createState());

    expect(markup).not.toContain('data-action="ai"');
    expect(markup).not.toContain('toolbar-ai-group');
    expect(markup).toContain('data-action="bold"');
  });

  it('keeps AI tools visible for a signed-out user with a custom provider', () => {
    useAccountSessionStore.setState({ isConnected: false });
    useUnifiedStore.setState((state) => ({
      data: {
        ...state.data,
        ai: {
          ...state.data.ai!,
          providers: [
            {
              id: 'custom-openai',
              name: 'Custom OpenAI',
              type: 'newapi',
              apiHost: 'https://example.com',
              apiKey: 'key',
              enabled: true,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
      },
    }));

    const markup = renderToolbarMarkup(createState());

    expect(markup).toContain('data-action="ai"');
    expect(markup).toContain('toolbar-ai-group');
  });

  it('renders neutral dropdown states for mixed selections and activates link/color buttons from shared state', () => {
    const markup = renderToolbarMarkup(
      createState({
        currentBlockType: null,
        currentAlignment: null,
        linkUrl: 'https://example.com',
        bgColor: '#ffeeaa',
      })
    );

    expect(markup).toContain('data-action="block"');
    expect(markup).toContain('data-action="alignment"');
    expect(markup).toContain('data-action="link"');
    expect(markup).toContain('data-action="color"');
    expect(markup).toContain('background-color: #ffeeaa');
    expect(markup).toContain('toolbar-color-icon');
    expect(markup).not.toContain('color-indicator');
    expect(markup).toContain('class="toolbar-btn has-tooltip active"');
  });

  it('applies the selected text color directly to the color toolbar icon', () => {
    const markup = renderToolbarMarkup(
      createState({
        textColor: '#dc2626',
      })
    );

    expect(markup).toContain('toolbar-color-icon');
    expect(markup).toContain('style="color: #dc2626"');
    expect(markup).not.toContain('color-indicator');
  });

  it('shows text color without also painting the color icon background', () => {
    const markup = renderToolbarMarkup(
      createState({
        textColor: '#dc2626',
        bgColor: '#ffeeaa',
      })
    );

    expect(markup).toContain('style="color: #dc2626"');
    expect(markup).not.toContain('background-color: #ffeeaa');
    expect(markup).not.toContain('class="toolbar-btn has-tooltip active"');
  });

  it('does not render the color toolbar button with active blue styling while its menu is open', () => {
    const markup = renderToolbarMarkup(
      createState({
        subMenu: 'color',
        bgColor: '#ffeeaa',
      })
    );

    expect(markup).toContain('data-action="color"');
    expect(markup).not.toMatch(/class="toolbar-btn has-tooltip active"[\s\S]*data-action="color"/);
  });

  it('renders the current block type button with an icon instead of an English label', () => {
    const markup = renderToolbarMarkup(
      createState({
        currentBlockType: 'blockquote',
      })
    );

    expect(markup).toContain('data-action="block"');
    expect(markup).not.toContain('block-type-label');
    expect(markup).not.toContain('Quote');
  });

  it('keeps the standard toolbar layout when the AI submenu is open', () => {
    const markup = renderToolbarMarkup(createState({ subMenu: 'ai' }));

    expect(markup).toContain('data-action="ai"');
    expect(markup).toContain('toolbar-ai-group');
    expect(markup).not.toContain('ai-composer-input');
    expect(markup).not.toContain('data-ai-prompt=');
  });

  it('renders the AI review panel when a suggestion is pending', () => {
    const markup = renderToolbarMarkup(
      createState({
        subMenu: 'aiReview',
        aiReview: {
          requestKey: 'review-1',
          instruction: 'Translate to English',
          commandId: 'translate-en',
          toneId: null,
          from: 1,
          to: 4,
          originalText: '你好啊',
          suggestedText: 'Hello there',
          isLoading: false,
          errorMessage: null,
        },
      })
    );

    expect(markup).toContain('ai-review-result-surface');
    expect(markup).toContain('ai-review-diff-added');
    expect(markup).toContain('ai-review-diff-removed');
    expect(markup).toContain('Hello there');
    expect(markup).toContain('你好啊');
    expect(markup).toContain('ai-review-footer');
    expect(markup).toContain('ai-review-model-selector-slot');
    expect(markup).toContain('ai-review-controls-left');
    expect(markup).toContain('ai-review-controls-right');
    expect(markup).toContain('data-review-action="retry"');
    expect(markup).toContain('aria-label="Retry"');
    expect(markup).toContain('aria-label="Cancel"');
    expect(markup).toContain('aria-label="Apply"');
    expect(markup).toContain('viewBox="0 0 256 256"');
    expect(markup).toContain('data-review-action="accept"');
    expect(markup).toContain('data-review-action="cancel"');
  });

  it('renders the shared loading slot while a suggestion is pending', () => {
    const markup = renderToolbarMarkup(
      createState({
        subMenu: 'aiReview',
        aiReview: {
          requestKey: 'review-loading',
          instruction: 'Polish the selected text.',
          commandId: 'polish',
          toneId: null,
          from: 1,
          to: 24,
          originalText: 'First line\nSecond longer line\n\nFourth line',
          suggestedText: '',
          isLoading: true,
          errorMessage: null,
        },
      })
    );

    expect(markup).toContain('ai-review-loading-slot');
    expect(markup).not.toContain('ai-review-loading-line');
  });

  it('does not render a deletion diff before a review command starts', () => {
    const markup = renderToolbarMarkup(
      createState({
        subMenu: 'aiReview',
        aiReview: {
          requestKey: 'review-empty',
          instruction: null,
          commandId: null,
          toneId: null,
          from: 1,
          to: 4,
          originalText: '你好啊',
          suggestedText: '',
          isLoading: false,
          errorMessage: null,
        },
      })
    );

    expect(markup).toContain('ai-review-result-surface');
    expect(markup).not.toContain('ai-review-diff-removed');
    expect(markup).not.toContain('你好啊');
  });

  it('renders an inline error state without diff output', () => {
    const markup = renderToolbarMarkup(
      createState({
        subMenu: 'aiReview',
        aiReview: {
          requestKey: 'review-error',
          instruction: 'Translate to English',
          commandId: 'translate-en',
          toneId: null,
          from: 1,
          to: 4,
          originalText: '你好啊',
          suggestedText: '',
          isLoading: false,
          errorMessage: 'Model request failed.',
        },
      })
    );

    expect(markup).toContain('ai-review-error');
    expect(markup).toContain('Model request failed.');
    expect(markup).not.toContain('ai-review-result-surface');
    expect(markup).not.toContain('ai-review-diff-removed');
  });
});
