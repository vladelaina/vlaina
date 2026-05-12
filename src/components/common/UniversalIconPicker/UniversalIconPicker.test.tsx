import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UniversalIconPicker } from './index';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';

vi.mock('./EmojiTab', () => ({
  EmojiTab: () => <div data-testid="emoji-tab" />,
}));

vi.mock('./UploadTab', () => ({
  UploadTab: () => <div data-testid="upload-tab" />,
}));

vi.mock('@/components/ui/premium-slider', () => ({
  PremiumSlider: () => <div data-testid="premium-slider" />,
}));

describe('UniversalIconPicker', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('uses the shared composer pill surface for the icon picker shell', () => {
    const { container } = render(
      <UniversalIconPicker
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const pickerShell = Array.from(container.querySelectorAll('div'))
      .find((element) => element.className.includes('!rounded-[26px]'));
    expect(pickerShell?.className).toContain(chatComposerPillSurfaceClass);
  });

  it('removes the current icon on pointer down without waiting for click', () => {
    const onRemove = vi.fn();
    const onClose = vi.fn();
    const onPreview = vi.fn();
    const onPreviewSkinTone = vi.fn();
    const parentPointerDown = vi.fn();
    const parentMouseDown = vi.fn();

    render(
      <div onPointerDown={parentPointerDown} onMouseDown={parentMouseDown}>
        <UniversalIconPicker
          onSelect={vi.fn()}
          onPreview={onPreview}
          onRemove={onRemove}
          onClose={onClose}
          onPreviewSkinTone={onPreviewSkinTone}
          hasIcon
          currentIcon="📝"
        />
      </div>,
    );

    const removeButton = screen.getByRole('button', { name: 'Remove' });
    fireEvent.pointerDown(removeButton);
    fireEvent.mouseDown(removeButton);
    fireEvent.click(removeButton);

    expect(parentPointerDown).not.toHaveBeenCalled();
    expect(parentMouseDown).not.toHaveBeenCalled();
    expect(onPreview).toHaveBeenCalledWith(null);
    expect(onPreviewSkinTone).toHaveBeenCalledWith(null);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when interacting with a sidebar context menu portal', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    render(
      <UniversalIconPicker
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );

    vi.advanceTimersByTime(100);

    const menuLayer = document.createElement('div');
    menuLayer.setAttribute('data-sidebar-context-menu-layer', 'true');
    const menuButton = document.createElement('button');
    menuButton.textContent = 'Delete';
    menuLayer.appendChild(menuButton);
    document.body.appendChild(menuLayer);

    fireEvent.mouseDown(menuButton);

    expect(onClose).not.toHaveBeenCalled();

    menuLayer.remove();
    vi.useRealTimers();
  });
});
