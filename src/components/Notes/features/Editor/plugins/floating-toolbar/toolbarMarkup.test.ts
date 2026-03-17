import { describe, expect, it } from 'vitest';
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
    ...overrides,
  };
}

describe('toolbar markup', () => {
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
    expect(markup).toContain('class="toolbar-btn has-tooltip active"');
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
        },
      })
    );

    expect(markup).toContain('data-review-command-select="true"');
    expect(markup).toContain('英语');
    expect(markup).toContain('Preview only changes');
    expect(markup).toContain('ai-review-result-surface');
    expect(markup).not.toContain('data-review-source-input="true"');
    expect(markup).not.toContain('data-review-result-input="true"');
    expect(markup).not.toContain('data-review-action="promote-result"');
    expect(markup).not.toContain('Selected text');
    expect(markup).not.toContain('ai-review-selected-strip');
    expect(markup).toContain('ai-review-diff-added');
    expect(markup).toContain('Hello there');
    expect(markup).toContain('data-review-action="accept"');
  });
});
