import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { renderBlockDropdown } from './BlockDropdown';

const previewMocks = vi.hoisted(() => ({
  applyBlockPreview: vi.fn(),
  clearFormatPreview: vi.fn(),
}));

vi.mock('../previewStyles', () => ({
  applyBlockPreview: previewMocks.applyBlockPreview,
  clearFormatPreview: previewMocks.clearFormatPreview,
  hasBlockPreview: vi.fn(() => true),
}));

vi.mock('../commands', () => ({
  convertBlockType: vi.fn(),
}));

function createView(): EditorView {
  return {} as EditorView;
}

describe('BlockDropdown', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    previewMocks.applyBlockPreview.mockReset();
    previewMocks.clearFormatPreview.mockReset();
  });

  it('keeps the preview while moving between dropdown items and clears it only after leaving the dropdown', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    renderBlockDropdown(
      container,
      createView(),
      {
        currentBlockType: 'paragraph',
      } as never,
      vi.fn()
    );

    const headingButton = container.querySelector<HTMLElement>('[data-block-type="heading1"]');
    const dropdown = container.querySelector<HTMLElement>('.block-dropdown');

    headingButton?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(previewMocks.applyBlockPreview).toHaveBeenCalledWith(expect.anything(), 'heading1');
    expect(previewMocks.clearFormatPreview).not.toHaveBeenCalled();

    headingButton?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));

    expect(previewMocks.clearFormatPreview).not.toHaveBeenCalled();

    dropdown?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(previewMocks.clearFormatPreview).toHaveBeenCalledTimes(1);
  });

  it('clears the preview when hovering the active block type item', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    renderBlockDropdown(
      container,
      createView(),
      {
        currentBlockType: 'paragraph',
      } as never,
      vi.fn()
    );

    const paragraphButton = container.querySelector<HTMLElement>('[data-block-type="paragraph"]');

    paragraphButton?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(previewMocks.clearFormatPreview).toHaveBeenCalledTimes(1);
    expect(previewMocks.applyBlockPreview).not.toHaveBeenCalled();
  });

  it('does not use native title tooltips for block type items', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    renderBlockDropdown(
      container,
      createView(),
      {
        currentBlockType: 'paragraph',
      } as never,
      vi.fn()
    );

    const headingButton = container.querySelector<HTMLElement>('[data-block-type="heading1"]');

    expect(headingButton?.getAttribute('title')).toBeNull();
    expect(headingButton?.getAttribute('aria-label')).toBe('Heading 1');
  });
});
