import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { bindAiDropdownInteractions } from './actions';
import { createAiDropdownMarkup } from './markup';

vi.mock('../../ai/sidebarDiscussion', () => ({
  openSidebarDiscussionForSelection: vi.fn(() => true),
}));

vi.mock('../../ai/reviewFlow', () => ({
  openAiSelectionReview: vi.fn(() => true),
  runAiSelectionReviewCommand: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../ai/reviewState', () => ({
  createAiReviewState: vi.fn(() => ({
    requestKey: 'review-1',
  })),
}));

vi.mock('./usageRanking', async () => {
  const actual = await vi.importActual<typeof import('./usageRanking')>('./usageRanking');
  return {
    ...actual,
    recordAiMenuItemUsage: vi.fn(),
  };
});

function createView(): EditorView {
  return {
    state: {
      selection: {
        from: 1,
        to: 4,
      },
    },
  } as unknown as EditorView;
}

describe('ai dropdown actions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('clears the active child panel when hovering a root action item', () => {
    const dropdown = document.createElement('div');
    dropdown.className = 'toolbar-submenu ai-dropdown ai-dropdown-nested';
    dropdown.innerHTML = createAiDropdownMarkup();

    document.body.appendChild(dropdown);
    bindAiDropdownInteractions(dropdown, createView());

    const translateCategory = dropdown.querySelector<HTMLElement>('[data-ai-category="translate"]');
    const translatePanel = dropdown.querySelector<HTMLElement>('[data-ai-panel="translate"]');
    const rootAction = dropdown.querySelector<HTMLElement>('.ai-dropdown-category-action[data-ai-command-id="discuss-in-sidebar"]');

    expect(translateCategory?.classList.contains('active')).toBe(false);
    expect(translatePanel?.classList.contains('active')).toBe(false);

    translateCategory?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(translateCategory?.classList.contains('active')).toBe(true);
    expect(translatePanel?.classList.contains('active')).toBe(true);

    rootAction?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(translateCategory?.classList.contains('active')).toBe(false);
    expect(translatePanel?.classList.contains('active')).toBe(false);
  });
});
