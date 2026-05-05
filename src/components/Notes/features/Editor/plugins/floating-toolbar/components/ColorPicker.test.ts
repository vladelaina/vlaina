import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { renderColorPicker } from './ColorPicker';

const previewMocks = vi.hoisted(() => ({
  applyColorPickerIdlePreview: vi.fn(),
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
  applyColorPickerIdlePreview: previewMocks.applyColorPickerIdlePreview,
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
    previewMocks.applyColorPickerIdlePreview.mockReset();
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

  it('hides the editor selection while hovering picker chrome outside swatches', () => {
    const container = document.createElement('div');
    const view = createView();
    document.body.appendChild(container);

    renderColorPicker(container, view, { textColor: null, bgColor: null } as never, vi.fn());

    const picker = container.querySelector<HTMLElement>('.color-picker');
    const label = container.querySelector<HTMLElement>('.color-picker-label');
    const textColorButton = container.querySelector<HTMLElement>('[data-type="text"] .color-picker-item:not(.color-picker-item-default)');

    label?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    textColorButton?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    expect(previewMocks.applyColorPickerIdlePreview).toHaveBeenCalledWith(view);
    expect(previewMocks.applyColorPickerIdlePreview).toHaveBeenCalledTimes(1);
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

  it('refocuses the editor after committing an active text color preview', () => {
    const container = document.createElement('div');
    const view = createView();
    const onClose = vi.fn();
    document.body.appendChild(container);
    previewMocks.commitTextColorPreview.mockReturnValue(true);

    renderColorPicker(container, view, { textColor: null, bgColor: null } as never, onClose);

    const textColorButton = container.querySelector<HTMLElement>('[data-type="text"] .color-picker-item:not(.color-picker-item-default)');

    textColorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(previewMocks.commitTextColorPreview).toHaveBeenCalledWith(view, textColorButton?.dataset.color);
    expect(commandMocks.setTextColor).not.toHaveBeenCalled();
    expect(view.focus).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('refocuses the editor after committing an active background color preview', () => {
    const container = document.createElement('div');
    const view = createView();
    const onClose = vi.fn();
    document.body.appendChild(container);
    previewMocks.commitBgColorPreview.mockReturnValue(true);

    renderColorPicker(container, view, { textColor: null, bgColor: null } as never, onClose);

    const bgColorButton = container.querySelector<HTMLElement>('[data-type="bg"] .color-picker-item:not(.color-picker-item-default)');

    bgColorButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(previewMocks.commitBgColorPreview).toHaveBeenCalledWith(view, bgColorButton?.dataset.color);
    expect(commandMocks.setBgColor).not.toHaveBeenCalled();
    expect(view.focus).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps selected color state without showing a blue active border', () => {
    const container = document.createElement('div');
    const view = createView();
    document.body.appendChild(container);

    renderColorPicker(container, view, { textColor: null, bgColor: null } as never, vi.fn());

    const firstColor = container.querySelector<HTMLElement>(
      '[data-type="text"] .color-picker-item:not(.color-picker-item-default)'
    )?.dataset.color;

    container.innerHTML = '';
    renderColorPicker(container, view, { textColor: firstColor, bgColor: null } as never, vi.fn());

    const activeColorButton = container.querySelector<HTMLElement>('[data-type="text"] .color-picker-item.active');

    expect(firstColor).toBeTruthy();
    expect(activeColorButton).not.toBeNull();
  });
});
