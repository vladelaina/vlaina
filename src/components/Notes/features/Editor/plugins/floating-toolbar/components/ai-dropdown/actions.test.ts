import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { bindAiDropdownInteractions } from './actions';
import { createAiDropdownMarkup } from './markup';

const blockSelectionMocks = vi.hoisted(() => ({
  hasSelectedBlocks: vi.fn(() => false),
}));

vi.mock('../../../cursor/blockSelectionPluginState', () => ({
  hasSelectedBlocks: blockSelectionMocks.hasSelectedBlocks,
}));

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
    vi.clearAllMocks();
    blockSelectionMocks.hasSelectedBlocks.mockReturnValue(false);
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

  it('shows the shortcut hint on the sidebar quote action', () => {
    const dropdown = document.createElement('div');
    dropdown.innerHTML = createAiDropdownMarkup();

    const rootAction = dropdown.querySelector<HTMLElement>('.ai-dropdown-category-action[data-ai-command-id="discuss-in-sidebar"]');
    expect(rootAction?.querySelector('.ai-dropdown-item-shortcut')?.textContent).toBe('Ctrl+L');
  });

  it('does not create an AI review from a stale text selection while block selection is active', async () => {
    const reviewState = await import('../../ai/reviewState');
    const dropdown = document.createElement('div');
    dropdown.innerHTML = createAiDropdownMarkup();
    document.body.appendChild(dropdown);
    blockSelectionMocks.hasSelectedBlocks.mockReturnValue(true);

    bindAiDropdownInteractions(dropdown, createView());
    const action = dropdown.querySelector<HTMLButtonElement>('[data-ai-command-id="polish"]');
    expect(action).not.toBeNull();
    action?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(reviewState.createAiReviewState).not.toHaveBeenCalled();
  });
});
