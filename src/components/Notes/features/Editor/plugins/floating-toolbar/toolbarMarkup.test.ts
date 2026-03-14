import { describe, expect, it } from 'vitest';
import { renderToolbarMarkup } from './toolbarMarkup';
import type { FloatingToolbarState } from './types';

function createState(overrides?: Partial<FloatingToolbarState>): FloatingToolbarState {
  return {
    isVisible: true,
    position: { x: 0, y: 0 },
    placement: 'top',
    activeMarks: new Set(),
    currentBlockType: 'paragraph',
    currentAlignment: 'left',
    copied: false,
    linkUrl: null,
    textColor: null,
    bgColor: null,
    subMenu: null,
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
});
