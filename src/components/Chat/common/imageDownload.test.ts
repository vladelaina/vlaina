import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeDesktopBinaryFile: vi.fn().mockResolvedValue(undefined),
  saveDialog: vi.fn().mockResolvedValue('/downloads/custom-image.png'),
  fetch: vi.fn(),
}));

vi.mock('@/lib/desktop/fs', () => ({
  writeDesktopBinaryFile: mocks.writeDesktopBinaryFile,
}));

vi.mock('@/lib/storage/dialog', () => ({
  saveDialog: mocks.saveDialog,
}));

import { downloadImageWithPrompt } from './imageDownload';

describe('imageDownload', () => {
  beforeEach(() => {
    mocks.writeDesktopBinaryFile.mockClear();
    mocks.saveDialog.mockClear();
    mocks.fetch.mockReset();
    vi.stubGlobal('fetch', mocks.fetch);
  });

  it('downloads fetched images to a user-selected file path', async () => {
    mocks.fetch.mockResolvedValue({
      blob: async () => ({
        type: 'image/png',
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }),
    });

    await downloadImageWithPrompt('https://example.com/cat', 'cat');

    expect(mocks.saveDialog).toHaveBeenCalledWith({
      title: 'Save image',
      defaultPath: 'cat.png',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] }],
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
  });
});
