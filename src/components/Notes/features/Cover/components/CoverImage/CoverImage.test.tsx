import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CoverImage } from './CoverImage';

const hoisted = vi.hoisted(() => ({
  useCoverImageControllerSpy: vi.fn(),
  shellSpy: vi.fn(),
}));

vi.mock('./hooks/useCoverImageController', () => ({
  useCoverImageController: (props: unknown) => hoisted.useCoverImageControllerSpy(props),
}));

vi.mock('./CoverImageShell', () => ({
  CoverImageShell: (props: unknown) => {
    hoisted.shellSpy(props);
    return <div data-testid="cover-image-shell" />;
  },
}));

describe('CoverImage', () => {
  it('delegates orchestration to controller hook and renders shell with controller props', () => {
    const shellProps = {
      url: '@monet/2',
      readOnly: false,
      vaultPath: '/vault-a',
      phase: 'ready' as const,
      showPicker: false,
      previewSrc: null,
      isError: false,
      displaySrc: '/covers/Claude Monet/2.webp',
      coverHeight: 320,
      positionX: 50,
      positionY: 50,
      containerRef: { current: null },
      onOpenPicker: vi.fn(),
      onClosePicker: vi.fn(),
      onSelectCover: vi.fn(),
      onPreview: vi.fn(),
      onRemoveCover: vi.fn(),
      onResizeMouseDown: vi.fn(),
      onResetHeight: vi.fn(),
      rendererProps: {
        placeholderSrc: '/covers/Claude Monet/2.webp',
        isImageReady: true,
        isResizing: false,
        wrapperRef: { current: null },
        frozenImgRef: { current: null },
        frozenImageState: null,
        crop: { x: 0, y: 0 },
        zoom: 1,
        effectiveContainerSize: { width: 800, height: 320 },
        effectiveMinZoom: 1,
        effectiveMaxZoom: 10,
        objectFitMode: 'horizontal-cover' as const,
        onCropperCropChange: vi.fn(),
        onCropperZoomChange: vi.fn(),
        onPointerIntent: vi.fn(),
        onNonPointerIntent: vi.fn(),
        onInteractionStart: vi.fn(),
        onInteractionEnd: vi.fn(),
        onMediaLoaded: vi.fn(),
      },
    };
    hoisted.useCoverImageControllerSpy.mockReturnValue(shellProps);

    render(
      <CoverImage
        url="@monet/2"
        positionX={10}
        positionY={90}
        height={300}
        scale={1.2}
        readOnly={true}
        onUpdate={vi.fn()}
        vaultPath="/vault-a"
        pickerOpen={true}
        onPickerOpenChange={vi.fn()}
      />
    );

    expect(hoisted.useCoverImageControllerSpy).toHaveBeenCalledWith({
      url: '@monet/2',
      positionX: 10,
      positionY: 90,
      initialHeight: 300,
      scale: 1.2,
      readOnly: true,
      onUpdate: expect.any(Function),
      vaultPath: '/vault-a',
      pickerOpen: true,
      onPickerOpenChange: expect.any(Function),
    });
    expect(hoisted.shellSpy).toHaveBeenCalledWith(shellProps);
  });
});
