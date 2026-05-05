import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { renderLinkEditor } from './LinkEditor';

const commandMocks = vi.hoisted(() => ({
  setLink: vi.fn(),
}));

const collapseMocks = vi.hoisted(() => ({
  collapseSelectionAfterToolbarApply: vi.fn(),
}));

vi.mock('../commands', () => ({
  setLink: commandMocks.setLink,
}));

vi.mock('../selectionCollapse', () => ({
  collapseSelectionAfterToolbarApply: collapseMocks.collapseSelectionAfterToolbarApply,
}));

function createView(): EditorView {
  return {} as EditorView;
}

describe('LinkEditor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    commandMocks.setLink.mockReset();
    collapseMocks.collapseSelectionAfterToolbarApply.mockReset();
  });

  it('collapses the toolbar selection after applying a link', () => {
    const container = document.createElement('div');
    const view = createView();
    const onClose = vi.fn();
    document.body.appendChild(container);

    renderLinkEditor(container, view, { linkUrl: null } as never, onClose);

    const input = container.querySelector<HTMLInputElement>('.link-editor-rail-input');
    expect(input).toBeInstanceOf(HTMLInputElement);
    input!.value = 'https://example.com';
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(commandMocks.setLink).toHaveBeenCalledWith(view, 'https://example.com');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(collapseMocks.collapseSelectionAfterToolbarApply).toHaveBeenCalledWith(view);
  });

  it('collapses the toolbar selection after clearing a link', () => {
    const container = document.createElement('div');
    const view = createView();
    const onClose = vi.fn();
    document.body.appendChild(container);

    renderLinkEditor(container, view, { linkUrl: 'https://example.com' } as never, onClose);

    const input = container.querySelector<HTMLInputElement>('.link-editor-rail-input');
    expect(input).toBeInstanceOf(HTMLInputElement);
    input!.value = '';
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(commandMocks.setLink).toHaveBeenCalledWith(view, null);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(collapseMocks.collapseSelectionAfterToolbarApply).toHaveBeenCalledWith(view);
  });
});
