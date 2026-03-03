import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CoverRenderer, type CoverRendererProps } from './CoverRenderer';

const { cropperSpy } = vi.hoisted(() => ({
  cropperSpy: vi.fn(),
}));

vi.mock('react-easy-crop', () => ({
  default: (props: unknown) => {
    cropperSpy(props);
    return <div data-testid="cover-cropper" />;
  },
}));

function buildProps(overrides?: Partial<CoverRendererProps>): CoverRendererProps {
  return {
    displaySrc: '/cover.png',
    isImageReady: false,
    isResizing: false,
    wrapperRef: createRef<HTMLDivElement>(),
    frozenImgRef: createRef<HTMLImageElement>(),
    frozenImageState: { top: 12, left: 22, width: 320, height: 180 },
    crop: { x: 10, y: 20 },
    zoom: 1.5,
    effectiveContainerSize: { width: 640, height: 240 },
    effectiveMinZoom: 1,
    effectiveMaxZoom: 10,
    objectFitMode: 'horizontal-cover',
    onCropperCropChange: vi.fn(),
    onCropperZoomChange: vi.fn(),
    onInteractionStart: vi.fn(),
    onInteractionEnd: vi.fn(),
    onMediaLoaded: vi.fn(),
    positionX: 40,
    positionY: 60,
    ...overrides,
  };
}

describe('CoverRenderer', () => {
  beforeEach(() => {
    cropperSpy.mockReset();
  });

  it('renders placeholder and cropper when not resizing', () => {
    const { container } = render(<CoverRenderer {...buildProps()} />);

    const placeholder = container.querySelector('img[alt="Cover"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder?.className.includes('opacity-100')).toBe(true);
    expect(placeholder?.className.includes('placeholder-active')).toBe(true);

    const cropper = container.querySelector('[data-testid="cover-cropper"]');
    expect(cropper).not.toBeNull();
    expect(cropperSpy).toHaveBeenCalledTimes(1);
  });

  it('hides cropper and shows frozen layer during resize', () => {
    const { container } = render(
      <CoverRenderer
        {...buildProps({
          isResizing: true,
          isImageReady: true,
        })}
      />
    );

    const cropper = container.querySelector('[data-testid="cover-cropper"]');
    expect(cropper).toBeNull();

    const frozen = container.querySelector('img[alt="Frozen Cover"]');
    expect(frozen).not.toBeNull();
    expect(frozen?.getAttribute('style')?.includes('top: 12px')).toBe(true);
    expect(frozen?.getAttribute('style')?.includes('left: 22px')).toBe(true);
    expect(frozen?.parentElement?.classList.contains('visible')).toBe(true);
    expect(frozen?.parentElement?.classList.contains('invisible')).toBe(false);
  });

  it('passes undefined image to cropper when source is empty', () => {
    const { container } = render(
      <CoverRenderer
        {...buildProps({
          displaySrc: '',
        })}
      />
    );

    expect(container.querySelector('img[alt="Cover"]')).toBeNull();
    expect(container.querySelector('img[alt="Frozen Cover"]')).toBeNull();
    expect(cropperSpy).toHaveBeenCalledTimes(1);
    expect(cropperSpy.mock.calls[0][0]).toMatchObject({
      image: undefined,
    });
  });
});
