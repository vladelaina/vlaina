import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adapter: {
    getBasePath: vi.fn().mockResolvedValue('/appdata'),
    exists: vi.fn().mockResolvedValue(false),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeBinaryFile: vi.fn().mockResolvedValue(undefined),
    readBinaryFile: vi.fn().mockResolvedValue(new Uint8Array([72, 73])),
    deleteFile: vi.fn().mockResolvedValue(undefined),
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

import {
  convertToBase64,
  deleteAttachment,
  persistDataUrlAttachment,
  saveAttachment,
} from './attachmentStorage';

describe('attachmentStorage', () => {
  beforeEach(() => {
    mocks.adapter.getBasePath.mockClear();
    mocks.adapter.exists.mockClear();
    mocks.adapter.mkdir.mockClear();
    mocks.adapter.writeBinaryFile.mockClear();
    mocks.adapter.readBinaryFile.mockClear();
    mocks.adapter.deleteFile.mockClear();
    mocks.joinPath.mockReset();
    mocks.joinPath.mockImplementation(async (...segments: string[]) => segments.join('/'));
    mocks.getElectronBridge.mockReturnValue({
      path: {
        toFileUrl: vi.fn().mockResolvedValue('file:///appdata/.vlaina/attachments/12345678-note.png'),
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
    expect(mocks.adapter.exists).toHaveBeenCalledWith('/appdata/.vlaina/attachments');
    expect(mocks.adapter.mkdir).toHaveBeenCalledWith('/appdata/.vlaina/attachments', true);
    expect(mocks.adapter.writeBinaryFile).toHaveBeenCalledWith(
      '/appdata/.vlaina/attachments/12345678-12345678.png',
      expect.any(Uint8Array),
      { recursive: true },
    );
    expect(attachment).toMatchObject({
      path: '/appdata/.vlaina/attachments/12345678-12345678.png',
      previewUrl: 'data:image/png;base64,PREVIEW',
      assetUrl: 'file:///appdata/.vlaina/attachments/12345678-note.png',
      name: 'note.png',
      type: 'image/png',
      size: 3,
    });
  });

  it('keeps temporary attachments in memory without writing to disk', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'note.png', { type: 'image/png' });

    const attachment = await saveAttachment(file, { persist: false });

    expect(mocks.adapter.getBasePath).not.toHaveBeenCalled();
    expect(mocks.adapter.writeBinaryFile).not.toHaveBeenCalled();
    expect(attachment).toMatchObject({
      path: '',
      previewUrl: 'data:image/png;base64,PREVIEW',
      assetUrl: '',
      name: 'note.png',
      type: 'image/png',
      size: 3,
    });
  });

  it('deletes persisted attachment files', async () => {
    await deleteAttachment({
      id: 'a',
      path: '/appdata/attachments/file.png',
      previewUrl: 'data:image/png;base64,INLINE',
      assetUrl: 'file:///appdata/attachments/file.png',
      name: 'file.png',
      type: 'image/png',
      size: 1,
    });

    expect(mocks.adapter.deleteFile).toHaveBeenCalledWith('/appdata/attachments/file.png');
  });

  it('persists inline data URLs into the attachments directory', async () => {
    await expect(persistDataUrlAttachment('data:image/png;base64,AQI=')).resolves.toBe(
      'attachment://12345678-12345678.png',
    );

    expect(mocks.adapter.writeBinaryFile).toHaveBeenCalledWith(
      '/appdata/.vlaina/attachments/12345678-12345678.png',
      new Uint8Array([1, 2]),
      { recursive: true },
    );
  });

  it('falls back to preview data for assetUrl when the electron path bridge is unavailable', async () => {
    mocks.getElectronBridge.mockReturnValue(null);

    const file = new File([new Uint8Array([1, 2, 3])], 'note.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new Uint8Array([1, 2, 3]).buffer,
      configurable: true,
    });

    const attachment = await saveAttachment(file);

    expect(attachment).toMatchObject({
      path: '/appdata/.vlaina/attachments/12345678-12345678.png',
      previewUrl: 'data:image/png;base64,PREVIEW',
      assetUrl: 'data:image/png;base64,PREVIEW',
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

  it('resolves stored attachment URLs from the attachments directory when converting to base64', async () => {
    await expect(convertToBase64({
      id: 'a',
      path: '',
      previewUrl: 'attachment://demo%20image.png',
      assetUrl: 'attachment://demo%20image.png',
      name: 'demo image.png',
      type: 'image/png',
      size: 2,
    })).resolves.toBe('data:image/png;base64,SEk=');

    expect(mocks.adapter.getBasePath).toHaveBeenCalled();
    expect(mocks.joinPath).toHaveBeenCalledWith('/appdata', '.vlaina', 'attachments', 'demo image.png');
    expect(mocks.adapter.readBinaryFile).toHaveBeenCalledWith('/appdata/.vlaina/attachments/demo image.png');
  });

});
