import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { renderAlignmentDropdown } from './AlignmentDropdown';

const previewMocks = vi.hoisted(() => ({
  applyAlignmentPreview: vi.fn(),
  clearFormatPreview: vi.fn(),
  commitAlignmentPreview: vi.fn(),
}));

const commandMocks = vi.hoisted(() => ({
  setTextAlignment: vi.fn(),
}));

const collapseMocks = vi.hoisted(() => ({
  collapseSelectionAfterToolbarApply: vi.fn(),
}));

vi.mock('../previewStyles', () => ({
  applyAlignmentPreview: previewMocks.applyAlignmentPreview,
  clearFormatPreview: previewMocks.clearFormatPreview,
  commitAlignmentPreview: previewMocks.commitAlignmentPreview,
}));

vi.mock('../selectionCollapse', () => ({
  collapseSelectionAfterToolbarApply: collapseMocks.collapseSelectionAfterToolbarApply,
}));

vi.mock('../commands', () => ({
  setTextAlignment: commandMocks.setTextAlignment,
}));

function createView(): EditorView {
  return { focus: vi.fn() } as unknown as EditorView;
}

describe('AlignmentDropdown', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    previewMocks.applyAlignmentPreview.mockReset();
    previewMocks.clearFormatPreview.mockReset();
    previewMocks.commitAlignmentPreview.mockReset();
    previewMocks.commitAlignmentPreview.mockReturnValue(false);
    commandMocks.setTextAlignment.mockReset();
    collapseMocks.collapseSelectionAfterToolbarApply.mockReset();
  });

  it('previews inactive alignment choices from the applied preview path on hover', () => {
    const container = document.createElement('div');
    const view = createView();
    document.body.appendChild(container);

    renderAlignmentDropdown(container, view, { currentAlignment: 'left' } as never, vi.fn());

    const centerButton = container.querySelector<HTMLElement>('[data-alignment="center"]');
    centerButton?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(previewMocks.applyAlignmentPreview).toHaveBeenCalledWith(view, 'center');
    expect(previewMocks.clearFormatPreview).not.toHaveBeenCalled();
  });

  it('previews active alignment through the same path and clears on click apply and dropdown leave', () => {
    const container = document.createElement('div');
    const view = createView();
    const onClose = vi.fn();
    document.body.appendChild(container);

    renderAlignmentDropdown(container, view, { currentAlignment: 'left' } as never, onClose);

    const leftButton = container.querySelector<HTMLElement>('[data-alignment="left"]');
    const centerButton = container.querySelector<HTMLElement>('[data-alignment="center"]');
    const dropdown = container.querySelector<HTMLElement>('.alignment-dropdown');

    leftButton?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    centerButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    dropdown?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(previewMocks.applyAlignmentPreview).toHaveBeenCalledWith(view, 'left');
    expect(previewMocks.clearFormatPreview).toHaveBeenCalledWith(view);
    expect(commandMocks.setTextAlignment).toHaveBeenCalledWith(view, 'center');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(collapseMocks.collapseSelectionAfterToolbarApply).toHaveBeenCalledWith(view);
  });
});
