import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { renderColorPicker } from './ColorPicker';

const previewMocks = vi.hoisted(() => ({
  applyBgColorPreview: vi.fn(),
  applyTextColorPreview: vi.fn(),
  clearFormatPreview: vi.fn(),
  commitBgColorPreview: vi.fn(),
  commitTextColorPreview: vi.fn(),
}));

const commandMocks = vi.hoisted(() => ({
  setBgColor: vi.fn(),
  setTextColor: vi.fn(),
}));

vi.mock('../previewStyles', () => ({
  applyBgColorPreview: previewMocks.applyBgColorPreview,
  applyTextColorPreview: previewMocks.applyTextColorPreview,
  clearFormatPreview: previewMocks.clearFormatPreview,
  commitBgColorPreview: previewMocks.commitBgColorPreview,
  commitTextColorPreview: previewMocks.commitTextColorPreview,
}));

vi.mock('../commands', () => ({
  setBgColor: commandMocks.setBgColor,
  setTextColor: commandMocks.setTextColor,
}));

function createView(): EditorView {
  return { focus: vi.fn() } as unknown as EditorView;
}

describe('ColorPicker', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    previewMocks.applyBgColorPreview.mockReset();
    previewMocks.applyTextColorPreview.mockReset();
    previewMocks.clearFormatPreview.mockReset();
    previewMocks.commitBgColorPreview.mockReset();
    previewMocks.commitTextColorPreview.mockReset();
    previewMocks.commitBgColorPreview.mockReturnValue(false);
    previewMocks.commitTextColorPreview.mockReturnValue(false);
    commandMocks.setBgColor.mockReset();
    commandMocks.setTextColor.mockReset();
  });

  it('previews text and background colors from the applied preview path on hover', () => {
    const container = document.createElement('div');
    const view = createView();
    document.body.appendChild(container);

    renderColorPicker(container, view, { textColor: null, bgColor: null } as never, vi.fn());

    const textColorButton = container.querySelector<HTMLElement>('[data-type="text"] .color-picker-item:not(.color-picker-item-default)');
    const bgColorButton = container.querySelector<HTMLElement>('[data-type="bg"] .color-picker-item:not(.color-picker-item-default)');

    textColorButton?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    bgColorButton?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(previewMocks.applyTextColorPreview).toHaveBeenCalledWith(view, textColorButton?.dataset.color);
    expect(previewMocks.applyBgColorPreview).toHaveBeenCalledWith(view, bgColorButton?.dataset.color);
  });

  it('clears the preview before applying a selected color and after leaving the picker', () => {
    const container = document.createElement('div');
    const view = createView();
    const onClose = vi.fn();
    document.body.appendChild(container);

    renderColorPicker(container, view, { textColor: null, bgColor: null } as never, onClose);

    const picker = container.querySelector<HTMLElement>('.color-picker');
    const textColorButton = container.querySelector<HTMLElement>('[data-type="text"] .color-picker-item:not(.color-picker-item-default)');

    textColorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    picker?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(previewMocks.clearFormatPreview).toHaveBeenCalledWith(view);
    expect(commandMocks.setTextColor).toHaveBeenCalledWith(view, textColorButton?.dataset.color);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
