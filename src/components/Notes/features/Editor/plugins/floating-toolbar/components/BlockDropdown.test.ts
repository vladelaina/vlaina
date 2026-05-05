import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { renderBlockDropdown } from './BlockDropdown';

const stateMocks = vi.hoisted(() => ({
  selectionNear: vi.fn(),
  textSelectionCreate: vi.fn(),
}));

const previewMocks = vi.hoisted(() => ({
  applyBlockPreview: vi.fn(),
  clearFormatPreview: vi.fn(),
  commitBlockPreview: vi.fn(),
}));

vi.mock('@milkdown/kit/prose/state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@milkdown/kit/prose/state')>();
  return {
    ...actual,
    Selection: {
      ...actual.Selection,
      near: stateMocks.selectionNear,
    },
    TextSelection: {
      ...actual.TextSelection,
      create: stateMocks.textSelectionCreate,
    },
  };
});

vi.mock('../previewStyles', () => ({
  applyBlockPreview: previewMocks.applyBlockPreview,
  clearFormatPreview: previewMocks.clearFormatPreview,
  commitBlockPreview: previewMocks.commitBlockPreview,
  hasBlockPreview: vi.fn(() => true),
}));

vi.mock('../commands', () => ({
  convertBlockType: vi.fn(),
}));

function createView(selection = { empty: true, from: 0, to: 0 }): EditorView {
  const doc = {
    content: {
      size: 100,
    },
    resolve: vi.fn((pos: number) => ({ pos })),
  };
  const tr = {
    doc,
    setMeta: vi.fn(() => tr),
    setSelection: vi.fn(() => tr),
  };

  return {
    dispatch: vi.fn(),
    focus: vi.fn(),
    state: {
      doc,
      selection,
      tr,
    },
  } as unknown as EditorView;
}

describe('BlockDropdown', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    stateMocks.selectionNear.mockReset();
    stateMocks.textSelectionCreate.mockReset();
    stateMocks.selectionNear.mockReturnValue({ type: 'near-selection' });
    stateMocks.textSelectionCreate.mockReturnValue({ type: 'text-selection' });
    previewMocks.applyBlockPreview.mockReset();
    previewMocks.clearFormatPreview.mockReset();
    previewMocks.commitBlockPreview.mockReset();
    previewMocks.commitBlockPreview.mockReturnValue(false);
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

  it('previews the active block type item through the same applied path', () => {
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

    expect(previewMocks.applyBlockPreview).toHaveBeenCalledWith(expect.anything(), 'paragraph');
    expect(previewMocks.clearFormatPreview).not.toHaveBeenCalled();
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

  it('collapses a restored editor selection after applying a block type', () => {
    const container = document.createElement('div');
    const view = createView();
    const restoredSelection = { empty: false, from: 6, to: 24 };
    const onClose = vi.fn(() => {
      (view.state as any).selection = restoredSelection;
    });
    document.body.appendChild(container);
    previewMocks.commitBlockPreview.mockReturnValue(true);

    renderBlockDropdown(
      container,
      view,
      {
        currentBlockType: 'paragraph',
      } as never,
      onClose
    );

    const codeBlockButton = container.querySelector<HTMLElement>('[data-block-type="codeBlock"]');

    codeBlockButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(previewMocks.commitBlockPreview).toHaveBeenCalledWith(view, 'codeBlock');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(stateMocks.textSelectionCreate).toHaveBeenCalledWith(view.state.doc, restoredSelection.to);
    expect(view.state.tr.setSelection).toHaveBeenCalledWith({ type: 'text-selection' });
    expect(view.state.tr.setMeta).toHaveBeenCalledWith('addToHistory', false);
    expect(view.dispatch).toHaveBeenCalledWith(view.state.tr);
  });
});
