import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UniversalIconPicker } from './index';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import {
  ACTIVE_TAB_KEY,
  ICON_COLOR_KEY,
  RECENT_ICONS_KEY,
  SKIN_TONE_KEY,
  loadActiveTab,
  loadIconColor,
  loadRecentIcons,
  loadSkinTone,
} from './constants';

vi.mock('./EmojiTab', () => ({
  EmojiTab: ({
    recentIcons,
    skinTone,
    imageLoader,
    allowLegacyImageScheme,
  }: {
    recentIcons: string[];
    skinTone: number;
    imageLoader?: (src: string) => Promise<string>;
    allowLegacyImageScheme?: boolean;
  }) => (
    <div
      data-testid="emoji-tab"
      data-recent={recentIcons.join(',')}
      data-skin-tone={skinTone}
      data-has-image-loader={imageLoader ? 'true' : 'false'}
      data-allow-legacy-image-scheme={allowLegacyImageScheme ? 'true' : 'false'}
    />
  ),
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
      .find((element) => element.className.includes('!rounded-[var(--vlaina-radius-26px)]'));
    expect(pickerShell?.className).toContain(chatComposerPillSurfaceClass);
    expect(container.querySelector('[data-no-editor-drag-box="true"]')).toBeInstanceOf(HTMLElement);
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
    const onClose = vi.fn();

    render(
      <UniversalIconPicker
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );

    const menuLayer = document.createElement('div');
    menuLayer.setAttribute('data-sidebar-context-menu-layer', 'true');
    const menuButton = document.createElement('button');
    menuButton.textContent = 'Delete';
    menuLayer.appendChild(menuButton);
    document.body.appendChild(menuLayer);

    fireEvent.pointerDown(menuButton);

    expect(onClose).not.toHaveBeenCalled();

    menuLayer.remove();
  });

  it('closes on the first outside pointer down after opening', () => {
    const onClose = vi.fn();

    render(
      <UniversalIconPicker
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.pointerDown(document.body);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from capture when an outside target stops propagation', () => {
    const onClose = vi.fn();

    render(
      <div>
        <UniversalIconPicker
          onSelect={vi.fn()}
          onClose={onClose}
        />
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
        >
          Outside editor target
        </button>
      </div>,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside editor target' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reloads picker preferences after cross-window storage updates', async () => {
    const onSkinToneChange = vi.fn();
    render(
      <UniversalIconPicker
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onSkinToneChange={onSkinToneChange}
      />,
    );

    expect(screen.getByTestId('emoji-tab')).toBeInTheDocument();

    act(() => {
      localStorage.setItem(ACTIVE_TAB_KEY, 'upload');
      window.dispatchEvent(new StorageEvent('storage', {
        key: ACTIVE_TAB_KEY,
        newValue: 'upload',
      }));
    });

    await waitFor(() => expect(screen.getByTestId('upload-tab')).toBeInTheDocument());

    act(() => {
      localStorage.setItem(ACTIVE_TAB_KEY, 'emoji');
      window.dispatchEvent(new StorageEvent('storage', {
        key: ACTIVE_TAB_KEY,
        newValue: 'emoji',
      }));

      localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify(['😀']));
      window.dispatchEvent(new StorageEvent('storage', {
        key: RECENT_ICONS_KEY,
        newValue: JSON.stringify(['😀']),
      }));

      localStorage.setItem(SKIN_TONE_KEY, '2');
      window.dispatchEvent(new StorageEvent('storage', {
        key: SKIN_TONE_KEY,
        newValue: '2',
      }));
    });

    await waitFor(() => expect(screen.getByTestId('emoji-tab')).toHaveAttribute('data-recent', '😀'));
    expect(screen.getByTestId('emoji-tab')).toHaveAttribute('data-skin-tone', '2');
    expect(onSkinToneChange).toHaveBeenCalledWith(2);
  });

  it('passes image and symbol icons through to recent icons', async () => {
    localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify([
      'assets/icons/logo.png',
      'img:assets/icons/legacy.png',
      'ICON:star:currentColor',
      '😀',
    ]));
    const imageLoader = vi.fn();

    render(
      <UniversalIconPicker
        onSelect={vi.fn()}
        onClose={vi.fn()}
        imageLoader={imageLoader}
      />,
    );

    expect(screen.getByTestId('emoji-tab')).toHaveAttribute(
      'data-recent',
      'assets/icons/logo.png,ICON:star:currentColor,😀',
    );
    expect(screen.getByTestId('emoji-tab')).toHaveAttribute('data-has-image-loader', 'true');
    expect(screen.getByTestId('emoji-tab')).toHaveAttribute('data-allow-legacy-image-scheme', 'false');
  });

  it('keeps legacy image-scheme recent icons when explicitly allowed', async () => {
    localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify([
      'img:assets/icons/legacy.png',
      '😀',
    ]));

    render(
      <UniversalIconPicker
        onSelect={vi.fn()}
        onClose={vi.fn()}
        allowLegacyImageScheme
      />,
    );

    expect(screen.getByTestId('emoji-tab')).toHaveAttribute(
      'data-recent',
      'img:assets/icons/legacy.png,😀',
    );
    expect(screen.getByTestId('emoji-tab')).toHaveAttribute('data-allow-legacy-image-scheme', 'true');
  });

  it('keeps image and symbol icons out of emoji-only recent icons', async () => {
    localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify([
      'assets/icons/logo.png',
      'ICON:star:currentColor',
      '😀',
    ]));

    render(
      <UniversalIconPicker
        onSelect={vi.fn()}
        onClose={vi.fn()}
        emojiOnly
      />,
    );

    expect(screen.getByTestId('emoji-tab')).toHaveAttribute('data-recent', '😀');
  });

  it('keeps the picker on emoji when the upload tab is disabled', async () => {
    localStorage.setItem(ACTIVE_TAB_KEY, 'upload');

    render(
      <UniversalIconPicker
        onSelect={vi.fn()}
        onClose={vi.fn()}
        showUploadTab={false}
      />,
    );

    expect(screen.getByTestId('emoji-tab')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('upload-tab')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Tab', ctrlKey: true });

    expect(screen.getByTestId('emoji-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('upload-tab')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: ACTIVE_TAB_KEY,
        newValue: 'upload',
      }));
    });

    expect(screen.getByTestId('emoji-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('upload-tab')).not.toBeInTheDocument();
  });

  it('ignores oversized persisted icon picker preferences', () => {
    localStorage.setItem(SKIN_TONE_KEY, '2'.repeat(65));
    localStorage.setItem(ICON_COLOR_KEY, 'a'.repeat(65));
    localStorage.setItem(ACTIVE_TAB_KEY, 'upload'.repeat(20));
    localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify(['😀', 'x'.repeat(2049)]));

    expect(loadSkinTone()).toBe(0);
    expect(loadIconColor()).toBe('amber');
    expect(loadActiveTab()).toBe('emoji');
    expect(loadRecentIcons()).toEqual(['😀']);
  });
});
