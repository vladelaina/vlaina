import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convertToBase64 } from '@/lib/storage/attachmentStorage';
import { ChatImageViewer } from './ChatImageViewer';

const svgMocks = vi.hoisted(() => ({
  rasterizeSvgDataUrlToPng: vi.fn(),
}));

const imageResolutionMocks = vi.hoisted(() => ({
  actualResolveSafeChatImageSource: null as null | ((src: string, id?: string) => Promise<string | null>),
  resolveSafeChatImageSource: vi.fn(),
}));

vi.mock('react-easy-crop', () => ({
  default: (props: { image?: string; setImageRef?: (ref: { current: HTMLImageElement | null }) => void }) => {
    const setImageNode = (node: HTMLImageElement | null) => {
      if (!node) {
        return;
      }
      Object.defineProperty(node, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          x: 300,
          y: 200,
          left: 300,
          top: 200,
          right: 500,
          bottom: 400,
          width: 200,
          height: 200,
          toJSON: () => ({}),
        }),
      });
      props.setImageRef?.({ current: node });
    };

    return (
      <>
        <img ref={setImageNode} alt="" data-testid="mock-cropper-image" src={props.image} />
        <div
          data-testid="mock-cropper"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        />
      </>
    );
  },
}));

vi.mock('@/lib/storage/attachmentStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage/attachmentStorage')>();
  return {
    ...actual,
    convertToBase64: vi.fn(),
  };
});

vi.mock('@/components/Chat/common/svgRasterize', () => ({
  isSvgDataUrl: (value: string) => value.trim().toLowerCase().startsWith('data:image/svg+xml'),
  rasterizeSvgDataUrlToPng: svgMocks.rasterizeSvgDataUrlToPng,
}));

vi.mock('@/components/Chat/common/chatImageSourceResolution', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/Chat/common/chatImageSourceResolution')>();
  imageResolutionMocks.actualResolveSafeChatImageSource = actual.resolveSafeChatImageSource;
  return {
    ...actual,
    resolveSafeChatImageSource: imageResolutionMocks.resolveSafeChatImageSource,
  };
});

describe('ChatImageViewer', () => {
  beforeEach(() => {
    vi.mocked(convertToBase64).mockReset();
    imageResolutionMocks.resolveSafeChatImageSource.mockReset();
    imageResolutionMocks.resolveSafeChatImageSource.mockImplementation((src: string, id?: string) => {
      if (!imageResolutionMocks.actualResolveSafeChatImageSource) {
        throw new Error('resolveSafeChatImageSource mock is not initialized');
      }
      return imageResolutionMocks.actualResolveSafeChatImageSource(src, id);
    });
    svgMocks.rasterizeSvgDataUrlToPng.mockReset();
    svgMocks.rasterizeSvgDataUrlToPng.mockResolvedValue('data:image/png;base64,RASTER');
  });

  it('closes when the blank area is pressed even if the cropper stops bubbling events', async () => {
    const onOpenChange = vi.fn();

    render(
      <ChatImageViewer
        open
        src="https://example.com/image.png"
        alt="preview"
        onOpenChange={onOpenChange}
      />,
    );

    const cropper = await screen.findByTestId('mock-cropper');
    fireEvent.pointerDown(cropper, { button: 0, clientX: 10, clientY: 10 });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the viewer open when the image area is pressed', async () => {
    const onOpenChange = vi.fn();

    render(
      <ChatImageViewer
        open
        src="https://example.com/image.png"
        alt="preview"
        onOpenChange={onOpenChange}
      />,
    );

    const image = await screen.findByTestId('mock-cropper-image');
    fireEvent.pointerDown(image, { button: 0, clientX: 350, clientY: 250 });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('resolves bare stored attachment filenames before rendering the cropper image', async () => {
    vi.mocked(convertToBase64).mockResolvedValue('data:image/jpeg;base64,VIEWER');
    const onOpenChange = vi.fn();

    render(
      <ChatImageViewer
        open
        src="demo.jpg"
        alt="preview"
        onOpenChange={onOpenChange}
      />,
    );

    const image = await screen.findByTestId('mock-cropper-image');
    await waitFor(() => {
      expect(image).toHaveAttribute('src', 'data:image/jpeg;base64,VIEWER');
    });
    expect(convertToBase64).toHaveBeenCalledWith(expect.objectContaining({
      previewUrl: 'demo.jpg',
      assetUrl: 'demo.jpg',
      name: 'demo.jpg',
      type: 'image/jpeg',
    }));
  });

  it('rasterizes stored SVG attachments before rendering the cropper image', async () => {
    vi.mocked(convertToBase64).mockResolvedValue('data:image/svg+xml;base64,PHN2Zz4=');
    const onOpenChange = vi.fn();

    render(
      <ChatImageViewer
        open
        src="diagram.svg"
        alt="preview"
        onOpenChange={onOpenChange}
      />,
    );

    const image = await screen.findByTestId('mock-cropper-image');
    await waitFor(() => {
      expect(image).toHaveAttribute('src', 'data:image/png;base64,RASTER');
    });
    expect(svgMocks.rasterizeSvgDataUrlToPng).toHaveBeenCalledWith('data:image/svg+xml;base64,PHN2Zz4=');
  });

  it('does not pass unsafe direct sources to the cropper image', async () => {
    const onOpenChange = vi.fn();

    render(
      <ChatImageViewer
        open
        src="javascript:alert(1)"
        alt="preview"
        onOpenChange={onOpenChange}
      />,
    );

    const image = await screen.findByTestId('mock-cropper-image');
    expect(image).toHaveAttribute(
      'src',
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
    );
  });

  it('still matches short decoded gallery image sources', async () => {
    const onOpenChange = vi.fn();

    render(
      <ChatImageViewer
        open
        src="https://example.com/demo%20image.png"
        alt="preview"
        gallery={[
          { id: 'current', src: 'https://example.com/demo image.png' },
          { id: 'next', src: 'https://example.com/next.png' },
        ]}
        onOpenChange={onOpenChange}
      />,
    );

    await screen.findByRole('dialog', { name: 'preview' });
    expect(await screen.findByRole('button', { name: 'Next image' })).toBeInTheDocument();
  });

  it('does not decode oversized gallery image sources for comparison', async () => {
    const onOpenChange = vi.fn();
    const encodedTail = `${'a'.repeat(4100)}%20image.png`;

    render(
      <ChatImageViewer
        open
        src={`https://example.com/${encodedTail}`}
        alt="preview"
        gallery={[
          { id: 'current', src: `https://example.com/${encodedTail.replace('%20', ' ')}` },
          { id: 'next', src: 'https://example.com/next.png' },
        ]}
        onOpenChange={onOpenChange}
      />,
    );

    await screen.findByRole('dialog', { name: 'preview' });
    expect(screen.queryByRole('button', { name: 'Next image' })).not.toBeInTheDocument();
  });

  it('does not keep direct data image sources in the resolved attachment cache', async () => {
    const onOpenChange = vi.fn();
    const src = 'data:image/png;base64,AAAA';
    const view = render(
      <ChatImageViewer
        open
        src={src}
        alt="preview"
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => {
      expect(imageResolutionMocks.resolveSafeChatImageSource).toHaveBeenCalledTimes(1);
    });

    view.rerender(
      <ChatImageViewer
        open={false}
        src={src}
        alt="preview"
        onOpenChange={onOpenChange}
      />,
    );
    view.rerender(
      <ChatImageViewer
        open
        src={src}
        alt="preview"
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => {
      expect(imageResolutionMocks.resolveSafeChatImageSource).toHaveBeenCalledTimes(2);
    });
  });

  it('keeps stored attachment resolutions cached across reopen', async () => {
    vi.mocked(convertToBase64).mockResolvedValue('data:image/jpeg;base64,CACHED');
    const onOpenChange = vi.fn();
    const view = render(
      <ChatImageViewer
        open
        src="cache-demo.jpg"
        alt="preview"
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => {
      expect(imageResolutionMocks.resolveSafeChatImageSource).toHaveBeenCalledTimes(1);
    });

    view.rerender(
      <ChatImageViewer
        open={false}
        src="cache-demo.jpg"
        alt="preview"
        onOpenChange={onOpenChange}
      />,
    );
    view.rerender(
      <ChatImageViewer
        open
        src="cache-demo.jpg"
        alt="preview"
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => {
      expect(imageResolutionMocks.resolveSafeChatImageSource).toHaveBeenCalledTimes(1);
    });
    expect(convertToBase64).toHaveBeenCalledTimes(1);
  });
});
