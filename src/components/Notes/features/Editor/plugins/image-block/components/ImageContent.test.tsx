import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageContent } from './ImageContent';

vi.mock('./ImageCropper', () => ({
  ImageCropper: () => <div data-testid="image-cropper" />,
}));

function renderImageContent(overrides: Partial<Parameters<typeof ImageContent>[0]> = {}) {
  const props: Parameters<typeof ImageContent>[0] = {
    isLoading: false,
    loadError: false,
    resolvedSrc: 'https://example.com/image.png',
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
    const { container, props } = renderImageContent();

    expect(screen.queryByTestId('image-cropper')).toBeNull();
    expect(screen.getByTestId('remote-image-placeholder')).toBeInTheDocument();

    const image = container.querySelector('img');
    expect(image).not.toBeNull();

    fireEvent.load(image!);

    expect(image).toHaveAttribute('src', 'https://example.com/image.png');
    expect(screen.queryByTestId('remote-image-placeholder')).toBeNull();
    expect(props.onMediaLoaded).toHaveBeenCalledTimes(1);
  });

  it('shows the not found state when a plain remote image fails to load', () => {
    const { container } = renderImageContent();

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    fireEvent.error(image!);

    expect(screen.getByText('Image not found')).toBeInTheDocument();
  });

  it('keeps using the cropper for local resolved images', () => {
    renderImageContent({ resolvedSrc: 'blob:local-image' });

    expect(screen.getByTestId('image-cropper')).toBeInTheDocument();
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
    });

    expect(screen.queryByTestId('image-cropper')).toBeNull();

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image).toHaveStyle({
      position: 'absolute',
      transform: 'scale(2) translate(-25%, -10%)',
      transformOrigin: 'top left',
    });

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
