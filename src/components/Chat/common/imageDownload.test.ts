import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeDesktopBinaryFile: vi.fn().mockResolvedValue(undefined),
  saveDialog: vi.fn().mockResolvedValue('/downloads/custom-image.png'),
  fetch: vi.fn(),
  convertToBase64: vi.fn(),
  rasterizeSvgDataUrlToPng: vi.fn(),
  rasterizeSvgBlobToPngBlob: vi.fn(),
}));

vi.mock('@/lib/desktop/fs', () => ({
  writeDesktopBinaryFile: mocks.writeDesktopBinaryFile,
}));

vi.mock('@/lib/storage/dialog', () => ({
  saveDialog: mocks.saveDialog,
}));

vi.mock('@/lib/storage/attachmentStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage/attachmentStorage')>();
  return {
    ...actual,
    convertToBase64: mocks.convertToBase64,
  };
});

vi.mock('./svgRasterize', () => ({
  isSvgDataUrl: (value: string) => value.trim().toLowerCase().startsWith('data:image/svg+xml'),
  isSvgImageMimeType: (value: string | null | undefined) => (value ?? '').split(';')[0].trim().toLowerCase() === 'image/svg+xml',
  rasterizeSvgDataUrlToPng: mocks.rasterizeSvgDataUrlToPng,
  rasterizeSvgBlobToPngBlob: mocks.rasterizeSvgBlobToPngBlob,
}));

import { MAX_CHAT_IMAGE_FETCH_BYTES } from './chatImageFetch';
import { downloadImageWithPrompt } from './imageDownload';

function imageResponse(blob: Blob) {
  return {
    headers: new Headers({
      'content-length': String(blob.size),
      'content-type': blob.type,
    }),
    blob: async () => blob,
  };
}

describe('imageDownload', () => {
  beforeEach(() => {
    mocks.writeDesktopBinaryFile.mockClear();
    mocks.saveDialog.mockClear();
    mocks.fetch.mockReset();
    mocks.convertToBase64.mockReset();
    mocks.rasterizeSvgDataUrlToPng.mockImplementation(async (value: string) => value);
    mocks.rasterizeSvgBlobToPngBlob.mockReset();
    mocks.rasterizeSvgBlobToPngBlob.mockImplementation(async (blob: Blob) => blob);
    vi.stubGlobal('fetch', mocks.fetch);
  });

  it('downloads fetched images to a user-selected file path', async () => {
    mocks.fetch.mockResolvedValue(imageResponse(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })));

    await downloadImageWithPrompt('https://example.com/cat', 'cat');

    expect(mocks.saveDialog).toHaveBeenCalledWith({
      title: 'Save image',
      defaultPath: 'cat.png',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
    });
    expect(mocks.writeDesktopBinaryFile).toHaveBeenCalledWith(
      '/downloads/custom-image.png',
      expect.any(Uint8Array),
    );
  });

  it('falls back to browser anchor download when fetch fails', async () => {
    mocks.fetch.mockRejectedValue(new Error('network'));
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName) as HTMLAnchorElement;
      if (tagName === 'a') {
        element.click = clickSpy;
      }
      return element;
    }) as typeof document.createElement);

    await downloadImageWithPrompt('https://example.com/image.jpg?size=full', '');

    expect(mocks.saveDialog).not.toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);

    createSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('does not fetch or anchor-download unsafe direct image sources', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    await downloadImageWithPrompt('javascript:alert(1)', 'bad');
    await downloadImageWithPrompt('http://127.0.0.1:3000/secret.png', 'local');
    await downloadImageWithPrompt('images/demo.png', 'relative');
    await downloadImageWithPrompt('asset://localhost/chat-inline-image/0', 'token');

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.saveDialog).not.toHaveBeenCalled();
    expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalled();

    appendSpy.mockRestore();
  });

  it('normalizes case-insensitive data image sources before downloading', async () => {
    mocks.fetch.mockResolvedValue(imageResponse(new Blob([new Uint8Array([1])], { type: 'image/png' })));

    await downloadImageWithPrompt('DATA:IMAGE/PNG;BASE64,eA==', 'inline');

    expect(mocks.fetch).toHaveBeenCalledWith('data:image/png;base64,eA==', expect.objectContaining({
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    }));
    expect(mocks.saveDialog).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: 'inline.png',
    }));
  });

  it('falls back to browser anchor download when fetch returns a non-image blob', async () => {
    mocks.fetch.mockResolvedValue(imageResponse(new Blob(['<html>not an image</html>'], { type: 'text/html' })));
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const appendCallsBefore = appendSpy.mock.calls.length;
    const removeCallsBefore = removeSpy.mock.calls.length;
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName) as HTMLAnchorElement;
      if (tagName === 'a') {
        element.click = clickSpy;
      }
      return element;
    }) as typeof document.createElement);

    await downloadImageWithPrompt('https://example.com/not-image.png', 'not-image');

    expect(mocks.saveDialog).not.toHaveBeenCalled();
    expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy.mock.calls.length - appendCallsBefore).toBe(1);
    expect(removeSpy.mock.calls.length - removeCallsBefore).toBe(1);

    createSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('resolves bare stored attachment filenames before downloading', async () => {
    mocks.convertToBase64.mockResolvedValue('data:image/jpeg;base64,eA==');
    mocks.fetch.mockResolvedValue(imageResponse(new Blob([new Uint8Array([4, 5, 6])], { type: 'image/jpeg' })));

    await downloadImageWithPrompt('demo.jpg', '');

    expect(mocks.convertToBase64).toHaveBeenCalledWith(expect.objectContaining({
      previewUrl: 'demo.jpg',
      assetUrl: 'demo.jpg',
      name: 'demo.jpg',
      type: 'image/jpeg',
    }));
    expect(mocks.fetch).toHaveBeenCalledWith('data:image/jpeg;base64,eA==', expect.objectContaining({
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    }));
    expect(mocks.saveDialog).toHaveBeenCalledWith(expect.objectContaining({
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp', 'gif', 'bmp'] }],
    }));
    expect(mocks.writeDesktopBinaryFile).toHaveBeenCalledWith(
      '/downloads/custom-image.png',
      expect.any(Uint8Array),
    );
  });

  it('rasterizes stored svg attachments before downloading', async () => {
    mocks.convertToBase64.mockResolvedValue('data:image/svg+xml;base64,PHN2Zz4=');
    mocks.rasterizeSvgDataUrlToPng.mockResolvedValue('data:image/png;base64,RASTER');
    mocks.fetch.mockResolvedValue(imageResponse(new Blob([new Uint8Array([7, 8, 9])], { type: 'image/png' })));

    await downloadImageWithPrompt('diagram.svg', 'diagram');

    expect(mocks.rasterizeSvgDataUrlToPng).toHaveBeenCalledWith('data:image/svg+xml;base64,PHN2Zz4=');
    expect(mocks.fetch).toHaveBeenCalledWith('data:image/png;base64,RASTER', expect.objectContaining({
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    }));
    expect(mocks.saveDialog).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: 'diagram.png',
    }));
    expect(mocks.writeDesktopBinaryFile).toHaveBeenCalledWith(
      '/downloads/custom-image.png',
      expect.any(Uint8Array),
    );
  });

  it('rasterizes fetched svg images before saving', async () => {
    const svgBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
    const pngBlob = new Blob([new Uint8Array([10, 11, 12])], { type: 'image/png' });
    mocks.fetch.mockResolvedValue(imageResponse(svgBlob));
    mocks.rasterizeSvgBlobToPngBlob.mockResolvedValue(pngBlob);

    await downloadImageWithPrompt('https://example.com/diagram.svg', 'diagram');

    expect(mocks.rasterizeSvgBlobToPngBlob).toHaveBeenCalledWith(svgBlob);
    expect(mocks.saveDialog).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: 'diagram.png',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
    }));
    expect(mocks.writeDesktopBinaryFile).toHaveBeenCalledWith(
      '/downloads/custom-image.png',
      expect.any(Uint8Array),
    );
  });

  it('does not anchor-download svg sources when fetch fails', async () => {
    mocks.fetch.mockRejectedValue(new Error('network'));
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    await downloadImageWithPrompt('https://example.com/diagram.svg', 'diagram');

    expect(mocks.saveDialog).not.toHaveBeenCalled();
    expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalled();

    appendSpy.mockRestore();
  });

  it('sanitizes control characters from the suggested file name', async () => {
    mocks.fetch.mockResolvedValue(imageResponse(new Blob([new Uint8Array([1])], { type: 'image/png' })));

    await downloadImageWithPrompt('https://example.com/image.png', 'report\u202Egnp.exe');

    expect(mocks.saveDialog).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: 'report_gnp.exe.png',
    }));
  });

  it('bounds the suggested file name from long alt text', async () => {
    mocks.fetch.mockResolvedValue(imageResponse(new Blob([new Uint8Array([1])], { type: 'image/png' })));

    await downloadImageWithPrompt('https://example.com/image.png', 'a'.repeat(2000));

    expect(mocks.saveDialog).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: `${'a'.repeat(180)}.png`,
    }));
  });

  it('does not read, save, or anchor-download oversized fetched image responses', async () => {
    const blob = vi.fn(async () => new Blob([new Uint8Array([1])], { type: 'image/png' }));
    mocks.fetch.mockResolvedValue({
      headers: new Headers({
        'content-length': String(MAX_CHAT_IMAGE_FETCH_BYTES + 1),
        'content-type': 'image/png',
      }),
      blob,
    });
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    await downloadImageWithPrompt('https://example.com/large.png', 'large');

    expect(blob).not.toHaveBeenCalled();
    expect(mocks.saveDialog).not.toHaveBeenCalled();
    expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalled();

    appendSpy.mockRestore();
  });

  it('does not save oversized rasterized SVG output', async () => {
    const svgBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
    const oversizedPngBlob = {
      type: 'image/png',
      size: MAX_CHAT_IMAGE_FETCH_BYTES + 1,
      arrayBuffer: vi.fn(),
    } as unknown as Blob;
    mocks.fetch.mockResolvedValue(imageResponse(svgBlob));
    mocks.rasterizeSvgBlobToPngBlob.mockResolvedValue(oversizedPngBlob);
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    await downloadImageWithPrompt('https://example.com/diagram.svg', 'diagram');

    expect(mocks.rasterizeSvgBlobToPngBlob).toHaveBeenCalledWith(svgBlob);
    expect(oversizedPngBlob.arrayBuffer).not.toHaveBeenCalled();
    expect(mocks.saveDialog).not.toHaveBeenCalled();
    expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalled();

    appendSpy.mockRestore();
  });

  it('does not save rasterized SVG output with invalid size metadata', async () => {
    const svgBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
    const invalidPngBlob = {
      type: 'image/png',
      size: -1,
      arrayBuffer: vi.fn(),
    } as unknown as Blob;
    mocks.fetch.mockResolvedValue(imageResponse(svgBlob));
    mocks.rasterizeSvgBlobToPngBlob.mockResolvedValue(invalidPngBlob);
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    await downloadImageWithPrompt('https://example.com/diagram.svg', 'diagram');

    expect(mocks.rasterizeSvgBlobToPngBlob).toHaveBeenCalledWith(svgBlob);
    expect(invalidPngBlob.arrayBuffer).not.toHaveBeenCalled();
    expect(mocks.saveDialog).not.toHaveBeenCalled();
    expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalled();

    appendSpy.mockRestore();
  });

  it('does not hang when fallback image blob reading is aborted', async () => {
    const originalArrayBufferDescriptor = Object.getOwnPropertyDescriptor(Blob.prototype, 'arrayBuffer');
    try {
      Object.defineProperty(Blob.prototype, 'arrayBuffer', {
        configurable: true,
        value: undefined,
      });
      vi.stubGlobal('FileReader', class {
        result: ArrayBuffer | null = null;
        error: Error | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        onabort: (() => void) | null = null;

        readAsArrayBuffer() {
          queueMicrotask(() => this.onabort?.());
        }
      });
      mocks.fetch.mockResolvedValue(imageResponse(new Blob([new Uint8Array([1])], { type: 'image/png' })));

      await expect(downloadImageWithPrompt('https://example.com/image.png', 'image')).rejects.toThrow(
        'Image blob read was aborted.',
      );
    } finally {
      if (originalArrayBufferDescriptor) {
        Object.defineProperty(Blob.prototype, 'arrayBuffer', originalArrayBufferDescriptor);
      }
    }
  });
});
