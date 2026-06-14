import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_LANGUAGE_PREFERENCE } from '@/lib/i18n';
import { useUIStore } from '@/stores/uiSlice';
import { ImageContent, __testing__ as imageContentTesting } from './ImageContent';

vi.mock('./ImageCropper', () => ({
  ImageCropper: () => <div data-testid="image-cropper" />,
}));

afterEach(() => {
  imageContentTesting.clearLoadedImageSrcCache();
  act(() => {
    useUIStore.getState().setLanguagePreference(SYSTEM_LANGUAGE_PREFERENCE);
  });
});

function renderImageContent(overrides: Partial<Parameters<typeof ImageContent>[0]> = {}) {
  const props: Parameters<typeof ImageContent>[0] = {
    isLoading: false,
    loadError: false,
    resolvedSrc: 'https://example.com/image.png',
    isRemoteImageSource: true,
    isDeferred: false,
    isReady: true,
    cropParams: null,
    containerSize: { width: 320, height: 180 },
    isSaving: false,
    isActive: false,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onResizeStart: vi.fn(),
    onMediaLoaded: vi.fn(),
    onStateChange: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<ImageContent {...props} />),
    props,
  };
}

describe('ImageContent', () => {
  it('renders plain public remote images outside crop mode', () => {
    const { container, props } = renderImageContent({
      sourceSrc: './assets/card.png#cardd#40%',
      sourceAlt: 'Card caption',
    });

    expect(screen.queryByTestId('image-cropper')).toBeNull();
    expect(screen.getByTestId('remote-image-placeholder')).toBeInTheDocument();

    const image = container.querySelector('img');
    expect(image).not.toBeNull();

    fireEvent.load(image!);

    expect(image).toHaveAttribute('src', 'https://example.com/image.png');
    expect(image).toHaveAttribute('data-src', './assets/card.png#cardd#40%');
    expect(image).toHaveAttribute('data-inject-url', './assets/card.png#cardd#40%');
    expect(image).toHaveAttribute('alt', 'Card caption');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(screen.queryByTestId('remote-image-placeholder')).toBeNull();
    expect(props.onMediaLoaded).toHaveBeenCalledTimes(1);
  });

  it('does not flash the remote placeholder for an image src already loaded in memory', () => {
    imageContentTesting.rememberLoadedImageSrc('https://example.com/image.png');
    const { container } = renderImageContent({
      sourceSrc: 'https://example.com/image.png',
    });

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(screen.queryByTestId('remote-image-placeholder')).toBeNull();
    expect(image).toHaveClass('opacity-[var(--vlaina-opacity-100)]');
  });

  it('shows the localized not found state when a plain remote image fails to load', () => {
    act(() => {
      useUIStore.getState().setLanguagePreference('zh-CN');
    });
    const { container } = renderImageContent();

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    act(() => {
      fireEvent.error(image!);
    });

    const message = screen.getByText('未找到图片');
    const placeholder = message.parentElement;

    expect(message).toBeInTheDocument();
    expect(placeholder).not.toHaveClass('bg-gray-50');
    expect(placeholder).not.toHaveClass('dark:bg-zinc-900');
    expect(placeholder).toHaveClass('border-dashed');
  });

  it('keeps using the cropper for local resolved images', () => {
    renderImageContent({ resolvedSrc: 'blob:local-image', isRemoteImageSource: false });

    expect(screen.getByTestId('image-cropper')).toBeInTheDocument();
  });

  it('renders a static placeholder before deferred images start loading', () => {
    renderImageContent({
      resolvedSrc: '',
      isDeferred: true,
      isReady: false,
      isLoading: false,
    });

    expect(screen.getByTestId('deferred-image-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('image-cropper')).toBeNull();
  });

  it('keeps deferred images as placeholders even after their resource was prefetched', () => {
    const { container } = renderImageContent({
      resolvedSrc: 'blob:prefetched-image',
      isDeferred: true,
      isReady: true,
    });

    expect(screen.getByTestId('deferred-image-placeholder')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders saved crop params as a passive preview outside crop mode', () => {
    const { container, props } = renderImageContent({
      cropParams: {
        x: 25,
        y: 10,
        width: 50,
        height: 50,
        ratio: 2,
      },
      isActive: false,
      sourceSrc: './assets/cropped.png#line',
      sourceAlt: 'Cropped caption',
    });

    expect(screen.queryByTestId('image-cropper')).toBeNull();

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image).toHaveStyle({
      position: 'absolute',
      transform: 'scale(2) translate(-25%, -10%)',
      transformOrigin: 'top left',
    });
    expect(image).toHaveAttribute('data-src', './assets/cropped.png#line');
    expect(image).toHaveAttribute('data-inject-url', './assets/cropped.png#line');
    expect(image).toHaveAttribute('alt', 'Cropped caption');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');

    fireEvent.load(image!);

    expect(props.onMediaLoaded).toHaveBeenCalledTimes(1);
  });

  it('uses the cropper when editing saved crop params', () => {
    renderImageContent({
      cropParams: {
        x: 25,
        y: 10,
        width: 50,
        height: 50,
        ratio: 2,
      },
      isActive: true,
    });

    expect(screen.getByTestId('image-cropper')).toBeInTheDocument();
  });
});
