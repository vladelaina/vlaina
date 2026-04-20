import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adapter: {
    getBasePath: vi.fn().mockResolvedValue('/appdata'),
    exists: vi.fn().mockResolvedValue(false),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeBinaryFile: vi.fn().mockResolvedValue(undefined),
    readBinaryFile: vi.fn().mockResolvedValue(new Uint8Array([72, 73])),
  },
  joinPath: vi.fn(),
  getElectronBridge: vi.fn(),
}));

vi.mock('./adapter', () => ({
  getStorageAdapter: () => mocks.adapter,
  joinPath: mocks.joinPath,
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: mocks.getElectronBridge,
}));

import { convertToBase64, saveAttachment } from './attachmentStorage';

describe('attachmentStorage', () => {
  beforeEach(() => {
    mocks.adapter.getBasePath.mockClear();
    mocks.adapter.exists.mockClear();
    mocks.adapter.mkdir.mockClear();
    mocks.adapter.writeBinaryFile.mockClear();
    mocks.adapter.readBinaryFile.mockClear();
    mocks.joinPath.mockReset();
    mocks.joinPath
      .mockResolvedValueOnce('/appdata/attachments')
      .mockResolvedValueOnce('/appdata/attachments/12345678-note.png');
    mocks.getElectronBridge.mockReturnValue({
      path: {
        toFileUrl: vi.fn().mockResolvedValue('file:///appdata/attachments/12345678-note.png'),
      },
    });
    vi.spyOn(Date, 'now').mockReturnValue(12345678);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-aaaa-bbbb-cccc-ddddeeeeffff');

    class MockFileReader {
      result: string | null = 'data:image/png;base64,PREVIEW';
      onload: null | (() => void) = null;
      onerror: null | ((error?: unknown) => void) = null;
      readAsDataURL() {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    vi.stubGlobal('FileReader', MockFileReader);
  });

  it('saves attachments to disk and returns file metadata', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'note.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new Uint8Array([1, 2, 3]).buffer,
      configurable: true,
    });
    const attachment = await saveAttachment(file);

    expect(mocks.adapter.getBasePath).toHaveBeenCalledTimes(1);
    expect(mocks.adapter.exists).toHaveBeenCalledWith('/appdata/attachments');
    expect(mocks.adapter.mkdir).toHaveBeenCalledWith('/appdata/attachments', true);
    expect(mocks.adapter.writeBinaryFile).toHaveBeenCalledWith(
      '/appdata/attachments/12345678-note.png',
      expect.any(Uint8Array),
      { recursive: true },
    );
    expect(attachment).toMatchObject({
      path: '/appdata/attachments/12345678-note.png',
      previewUrl: 'data:image/png;base64,PREVIEW',
      assetUrl: 'file:///appdata/attachments/12345678-note.png',
      name: 'note.png',
      type: 'image/png',
      size: 3,
    });
  });

  it('reuses existing preview data when converting to base64', async () => {
    await expect(convertToBase64({
      id: 'a',
      path: '',
      previewUrl: 'data:image/png;base64,INLINE',
      assetUrl: '',
      name: 'note.png',
      type: 'image/png',
      size: 1,
    })).resolves.toBe('data:image/png;base64,INLINE');
  });

  it('falls back to disk reads when preview data is not inline', async () => {
    await expect(convertToBase64({
      id: 'a',
      path: '/appdata/attachments/file.bin',
      previewUrl: 'blob:preview',
      assetUrl: '',
      name: 'file.bin',
      type: 'application/octet-stream',
      size: 2,
    })).resolves.toBe('data:application/octet-stream;base64,SEk=');

    expect(mocks.adapter.readBinaryFile).toHaveBeenCalledWith('/appdata/attachments/file.bin');
  });
});
