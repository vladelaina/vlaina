import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adapter: {
    getBasePath: vi.fn().mockResolvedValue('/appdata'),
    exists: vi.fn().mockResolvedValue(false),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeBinaryFile: vi.fn().mockResolvedValue(undefined),
    readBinaryFile: vi.fn().mockResolvedValue(new Uint8Array([72, 73])),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue(null),
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

vi.mock('@/lib/markdown/svgSanitizer', () => ({
  sanitizeSvgBytes: (bytes: Uint8Array) => new TextEncoder().encode(
    new TextDecoder().decode(bytes).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''),
  ),
}));

import {
  convertToBase64,
  createStoredAttachmentFromSource,
  deleteAttachment,
  MAX_ATTACHMENT_IMAGE_BYTES,
  MAX_ATTACHMENT_TEXT_BYTES,
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
    mocks.adapter.stat.mockReset();
    mocks.adapter.stat.mockResolvedValue({
      name: 'file.png',
      path: '/appdata/.vlaina/chat/attachments/file.png',
      isDirectory: false,
      isFile: true,
      size: 2,
    });
    mocks.joinPath.mockReset();
    mocks.joinPath.mockImplementation(async (...segments: string[]) => segments.join('/'));
    mocks.getElectronBridge.mockReturnValue({
      path: {
        toFileUrl: vi.fn().mockResolvedValue('file:///appdata/.vlaina/chat/attachments/12345678-note.png'),
      },
    });
    vi.spyOn(Date, 'now').mockReturnValue(12345678);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-aaaa-bbbb-cccc-ddddeeeeffff');
  });

  it('saves attachments to disk and returns file metadata', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'note.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new Uint8Array([1, 2, 3]).buffer,
      configurable: true,
    });
    const attachment = await saveAttachment(file);

    expect(mocks.adapter.getBasePath).toHaveBeenCalledTimes(1);
    expect(mocks.adapter.exists).toHaveBeenCalledWith('/appdata/.vlaina/chat/attachments');
    expect(mocks.adapter.mkdir).toHaveBeenCalledWith('/appdata/.vlaina/chat/attachments', true);
    expect(mocks.adapter.writeBinaryFile).toHaveBeenCalledWith(
      '/appdata/.vlaina/chat/attachments/12345678-12345678.png',
      new Uint8Array([1, 2, 3]),
      { recursive: true },
    );
    expect(attachment).toMatchObject({
      path: '/appdata/.vlaina/chat/attachments/12345678-12345678.png',
      previewUrl: 'data:image/png;base64,AQID',
      assetUrl: 'file:///appdata/.vlaina/chat/attachments/12345678-note.png',
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
      previewUrl: 'data:image/png;base64,AQID',
      assetUrl: '',
      name: 'note.png',
      type: 'image/png',
      size: 3,
    });
  });

  it('saves supported text attachments with decoded content', async () => {
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });

    const attachment = await saveAttachment(file);

    expect(mocks.adapter.writeBinaryFile.mock.calls[0]?.[0]).toBe(
      '/appdata/.vlaina/chat/attachments/12345678-12345678.txt',
    );
    expect(Array.from(mocks.adapter.writeBinaryFile.mock.calls[0]?.[1] as Uint8Array)).toEqual(
      Array.from(new TextEncoder().encode('hello')),
    );
    expect(mocks.adapter.writeBinaryFile.mock.calls[0]?.[2]).toEqual({ recursive: true });
    expect(attachment).toMatchObject({
      path: '/appdata/.vlaina/chat/attachments/12345678-12345678.txt',
      previewUrl: '',
      assetUrl: 'file:///appdata/.vlaina/chat/attachments/12345678-note.png',
      name: 'note.txt',
      type: 'text/plain',
      size: 5,
      textContent: 'hello',
    });
  });

  it('keeps temporary text attachments in memory without writing to disk', async () => {
    const file = new File(['# Heading'], 'note.md', { type: '' });

    const attachment = await saveAttachment(file, { persist: false });

    expect(mocks.adapter.getBasePath).not.toHaveBeenCalled();
    expect(mocks.adapter.writeBinaryFile).not.toHaveBeenCalled();
    expect(attachment).toMatchObject({
      path: '',
      previewUrl: '',
      assetUrl: '',
      name: 'note.md',
      type: 'text/markdown',
      size: 9,
      textContent: '# Heading',
    });
  });

  it('rejects unsupported file attachments before reading storage', async () => {
    const file = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });

    await expect(saveAttachment(file)).rejects.toThrow('Unsupported attachment type');

    expect(mocks.adapter.getBasePath).not.toHaveBeenCalled();
    expect(mocks.adapter.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('rejects unsupported image attachment MIME types', async () => {
    const file = new File(['heic'], 'photo.heic', { type: 'image/heic' });

    await expect(saveAttachment(file)).rejects.toThrow('Unsupported attachment type');

    expect(mocks.adapter.getBasePath).not.toHaveBeenCalled();
    expect(mocks.adapter.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('does not create stored attachments from non-image filenames', () => {
    expect(createStoredAttachmentFromSource('secret.txt')).toBeNull();
    expect(createStoredAttachmentFromSource('attachment://secret.txt')).toBeNull();
    expect(createStoredAttachmentFromSource('demo.png')).toBeNull();
  });

  it('rejects oversized image attachments before reading or writing them', async () => {
    const file = new File(['small'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', {
      configurable: true,
      value: MAX_ATTACHMENT_IMAGE_BYTES + 1,
    });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn(async () => new Uint8Array([1]).buffer),
    });

    await expect(saveAttachment(file)).rejects.toThrow('Attachment image is too large.');

    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(mocks.adapter.getBasePath).not.toHaveBeenCalled();
    expect(mocks.adapter.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('rejects oversized text attachments before reading or writing them', async () => {
    const file = new File(['small'], 'huge.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', {
      configurable: true,
      value: MAX_ATTACHMENT_TEXT_BYTES + 1,
    });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn(async () => new Uint8Array([1]).buffer),
    });

    await expect(saveAttachment(file)).rejects.toThrow('Attachment file is too large.');

    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(mocks.adapter.getBasePath).not.toHaveBeenCalled();
    expect(mocks.adapter.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('rejects when fallback attachment byte reads are aborted', async () => {
    const OriginalFileReader = globalThis.FileReader;
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;

      readAsArrayBuffer() {
        setTimeout(() => {
          this.onabort?.();
        }, 0);
      }
    }

    vi.stubGlobal('FileReader', MockFileReader);
    try {
      const file = new File(['x'], 'note.png', { type: 'image/png' });
      Object.defineProperty(file, 'arrayBuffer', {
        configurable: true,
        value: undefined,
      });

      await expect(saveAttachment(file)).rejects.toThrow('Attachment file read was aborted');
    } finally {
      vi.stubGlobal('FileReader', OriginalFileReader);
    }
  });

  it('infers supported image attachments from the filename when MIME metadata is missing', async () => {
    const file = new File([new Uint8Array([4, 5, 6])], 'photo.webp', { type: '' });

    const attachment = await saveAttachment(file, { persist: false });

    expect(attachment).toMatchObject({
      path: '',
      previewUrl: 'data:image/webp;base64,BAUG',
      assetUrl: '',
      name: 'photo.webp',
      type: 'image/webp',
      size: 3,
    });
  });

  it('normalizes persisted attachment extensions to match the image MIME type', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'note.txt', { type: 'image/png' });

    await expect(saveAttachment(file)).resolves.toMatchObject({
      path: '/appdata/.vlaina/chat/attachments/12345678-12345678.png',
      type: 'image/png',
    });
    expect(mocks.adapter.writeBinaryFile).toHaveBeenCalledWith(
      '/appdata/.vlaina/chat/attachments/12345678-12345678.png',
      new Uint8Array([1, 2, 3]),
      { recursive: true },
    );
  });

  it('sanitizes SVG attachments before previewing and writing them', async () => {
    const file = new File(['<svg><script>alert(1)</script><path /></svg>'], 'diagram.svg', { type: 'image/svg+xml' });

    const attachment = await saveAttachment(file);

    const writtenBytes = mocks.adapter.writeBinaryFile.mock.calls[0][1] as Uint8Array;
    const writtenText = new TextDecoder().decode(writtenBytes);
    expect(writtenText).toBe('<svg><path /></svg>');
    expect(attachment.previewUrl).toBe(`data:image/svg+xml;base64,${window.btoa('<svg><path /></svg>')}`);
    expect(attachment.type).toBe('image/svg+xml');
  });

  it('deletes persisted attachment files', async () => {
    await deleteAttachment({
      id: 'a',
      path: '/appdata/.vlaina/chat/attachments/file.png',
      previewUrl: 'data:image/png;base64,INLINE',
      assetUrl: 'file:///appdata/.vlaina/chat/attachments/file.png',
      name: 'file.png',
      type: 'image/png',
      size: 1,
    });

    expect(mocks.adapter.deleteFile).toHaveBeenCalledWith('/appdata/.vlaina/chat/attachments/file.png');
  });

  it('does not delete attachment paths outside the managed attachments directory', async () => {
    await deleteAttachment({
      id: 'a',
      path: '/vault/images/file.png',
      previewUrl: 'blob:preview',
      assetUrl: '',
      name: 'file.png',
      type: 'image/png',
      size: 1,
    });

    expect(mocks.adapter.deleteFile).not.toHaveBeenCalled();
  });

  it('does not delete nested paths inside the managed attachments directory', async () => {
    await deleteAttachment({
      id: 'a',
      path: '/appdata/.vlaina/chat/attachments/nested/file.png',
      previewUrl: 'blob:preview',
      assetUrl: '',
      name: 'file.png',
      type: 'image/png',
      size: 1,
    });

    expect(mocks.adapter.deleteFile).not.toHaveBeenCalled();
  });

  it('deletes stored attachment URL files from the managed attachments directory', async () => {
    await deleteAttachment({
      id: 'a',
      path: '',
      previewUrl: 'attachment://demo%20image.png',
      assetUrl: '',
      name: 'demo image.png',
      type: 'image/png',
      size: 1,
    });

    expect(mocks.adapter.deleteFile).toHaveBeenCalledWith('/appdata/.vlaina/chat/attachments/demo image.png');
  });

  it('persists inline data URLs into the attachments directory', async () => {
    await expect(persistDataUrlAttachment('data:image/png;base64,AQI=')).resolves.toBe(
      'attachment://12345678-12345678.png',
    );

    expect(mocks.adapter.writeBinaryFile).toHaveBeenCalledWith(
      '/appdata/.vlaina/chat/attachments/12345678-12345678.png',
      new Uint8Array([1, 2]),
      { recursive: true },
    );
  });

  it('persists inline data URLs with case-insensitive schemes', async () => {
    await expect(persistDataUrlAttachment('DATA:IMAGE/WEBP;BASE64,AQI=')).resolves.toBe(
      'attachment://12345678-12345678.webp',
    );

    expect(mocks.adapter.writeBinaryFile).toHaveBeenCalledWith(
      '/appdata/.vlaina/chat/attachments/12345678-12345678.webp',
      new Uint8Array([1, 2]),
      { recursive: true },
    );
  });

  it('does not persist unsupported data URL attachments', async () => {
    await expect(persistDataUrlAttachment('data:text/plain,hello')).resolves.toBeNull();
    await expect(persistDataUrlAttachment('data:image/svg+xml;base64,PHN2Zz4=')).resolves.toBeNull();
    await expect(persistDataUrlAttachment('data:image/png,not-base64')).resolves.toBeNull();

    expect(mocks.adapter.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('ignores malformed percent-encoded text data URLs', async () => {
    await expect(persistDataUrlAttachment('data:text/plain,broken%ZZpayload')).resolves.toBeNull();

    expect(mocks.adapter.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('ignores malformed base64 data URLs', async () => {
    await expect(persistDataUrlAttachment('data:image/png;base64,%%%%')).resolves.toBeNull();

    expect(mocks.adapter.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('does not persist oversized inline data URL attachments', async () => {
    const payload = 'A'.repeat(Math.ceil((MAX_ATTACHMENT_IMAGE_BYTES + 1) / 3) * 4);

    await expect(persistDataUrlAttachment(`data:image/png;base64,${payload}`)).resolves.toBeNull();

    expect(mocks.adapter.getBasePath).not.toHaveBeenCalled();
    expect(mocks.adapter.writeBinaryFile).not.toHaveBeenCalled();
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
      path: '/appdata/.vlaina/chat/attachments/12345678-12345678.png',
      previewUrl: 'data:image/png;base64,AQID',
      assetUrl: 'data:image/png;base64,AQID',
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

  it('reuses existing preview data with a case-insensitive data URL scheme when converting to base64', async () => {
    await expect(convertToBase64({
      id: 'a',
      path: '',
      previewUrl: 'DATA:IMAGE/PNG;BASE64,INLINE',
      assetUrl: '',
      name: 'note.png',
      type: 'image/png',
      size: 1,
    })).resolves.toBe('DATA:IMAGE/PNG;BASE64,INLINE');

    expect(mocks.adapter.readBinaryFile).not.toHaveBeenCalled();
  });

  it('sanitizes existing SVG preview data when converting to base64', async () => {
    const unsafeSvg = '<svg><script>alert(1)</script><path /></svg>';
    const safeSvg = '<svg><path /></svg>';

    await expect(convertToBase64({
      id: 'a',
      path: '',
      previewUrl: `data:image/svg+xml;base64,${window.btoa(unsafeSvg)}`,
      assetUrl: '',
      name: 'diagram.svg',
      type: 'image/svg+xml',
      size: unsafeSvg.length,
    })).resolves.toBe(`data:image/svg+xml;base64,${window.btoa(safeSvg)}`);

    expect(mocks.adapter.readBinaryFile).not.toHaveBeenCalled();
  });

  it('creates stored attachment metadata only from safe stored sources', () => {
    expect(createStoredAttachmentFromSource('attachment://demo.jpg', 'image')).toMatchObject({
      id: 'image',
      path: '',
      previewUrl: 'attachment://demo.jpg',
      assetUrl: 'attachment://demo.jpg',
      name: 'demo.jpg',
      type: 'image/jpeg',
      size: 0,
    });
    expect(createStoredAttachmentFromSource('attachment://demo%20image.webp')).toMatchObject({
      previewUrl: 'attachment://demo%20image.webp',
      assetUrl: 'attachment://demo%20image.webp',
      name: 'demo image.webp',
      type: 'image/webp',
    });
    expect(createStoredAttachmentFromSource('images/demo.jpg')).toBeNull();
    expect(createStoredAttachmentFromSource('attachment://..%2Fsecret.png')).toBeNull();
  });

  it('reads managed attachment paths when preview data is not inline', async () => {
    await expect(convertToBase64({
      id: 'a',
      path: '/appdata/.vlaina/chat/attachments/file.png',
      previewUrl: 'blob:preview',
      assetUrl: '',
      name: 'file.png',
      type: 'image/png',
      size: 2,
    })).resolves.toBe('data:image/png;base64,SEk=');

    expect(mocks.adapter.readBinaryFile).toHaveBeenCalledWith('/appdata/.vlaina/chat/attachments/file.png', MAX_ATTACHMENT_IMAGE_BYTES);
  });

  it('sanitizes managed SVG attachment files when converting to base64', async () => {
    const unsafeSvg = '<svg><script>alert(1)</script><path /></svg>';
    const safeSvg = '<svg><path /></svg>';
    mocks.adapter.readBinaryFile.mockResolvedValueOnce(new TextEncoder().encode(unsafeSvg));

    await expect(convertToBase64({
      id: 'a',
      path: '/appdata/.vlaina/chat/attachments/diagram.svg',
      previewUrl: 'blob:preview',
      assetUrl: '',
      name: 'diagram.svg',
      type: 'image/svg+xml',
      size: unsafeSvg.length,
    })).resolves.toBe(`data:image/svg+xml;base64,${window.btoa(safeSvg)}`);

    expect(mocks.adapter.readBinaryFile).toHaveBeenCalledWith(
      '/appdata/.vlaina/chat/attachments/diagram.svg',
      MAX_ATTACHMENT_IMAGE_BYTES,
    );
  });

  it('reads explicitly allowed attachment paths when preview data is not inline', async () => {
    await expect(convertToBase64({
      id: 'a',
      path: '/vault/assets/file.png',
      previewUrl: 'blob:preview',
      assetUrl: '',
      name: 'file.png',
      type: 'image/png',
      size: 2,
    }, {
      allowPath: (path) => path.startsWith('/vault/'),
    })).resolves.toBe('data:image/png;base64,SEk=');

    expect(mocks.adapter.readBinaryFile).toHaveBeenCalledWith('/vault/assets/file.png', MAX_ATTACHMENT_IMAGE_BYTES);
  });

  it('does not read untrusted attachment paths when converting to base64', async () => {
    await expect(convertToBase64({
      id: 'a',
      path: '/etc/secret.png',
      previewUrl: 'blob:preview',
      assetUrl: '',
      name: 'secret.png',
      type: 'image/png',
      size: 2,
    })).rejects.toThrow('Cannot convert attachment to Base64');

    expect(mocks.adapter.readBinaryFile).not.toHaveBeenCalled();
  });

  it('rejects oversized allowed disk attachments when converting to base64', async () => {
    mocks.adapter.readBinaryFile.mockResolvedValueOnce({
      byteLength: MAX_ATTACHMENT_IMAGE_BYTES + 1,
    });

    await expect(convertToBase64({
      id: 'a',
      path: '/vault/assets/huge.png',
      previewUrl: 'blob:preview',
      assetUrl: '',
      name: 'huge.png',
      type: 'image/png',
      size: MAX_ATTACHMENT_IMAGE_BYTES + 1,
    }, {
      allowPath: (path) => path.startsWith('/vault/'),
    })).rejects.toThrow('Cannot convert attachment to Base64');
  });

  it('rejects oversized allowed attachment paths before reading them when stat has a size', async () => {
    mocks.adapter.stat.mockResolvedValueOnce({
      size: MAX_ATTACHMENT_IMAGE_BYTES + 1,
    });

    await expect(convertToBase64({
      id: 'a',
      path: '/vault/assets/huge.png',
      previewUrl: 'blob:preview',
      assetUrl: '',
      name: 'huge.png',
      type: 'image/png',
      size: MAX_ATTACHMENT_IMAGE_BYTES + 1,
    }, {
      allowPath: (path) => path.startsWith('/vault/'),
    })).rejects.toThrow('Cannot convert attachment to Base64');

    expect(mocks.adapter.stat).toHaveBeenCalledWith('/vault/assets/huge.png');
    expect(mocks.adapter.readBinaryFile).not.toHaveBeenCalled();
  });

  it('rejects allowed attachment paths with invalid known stat sizes before reading them', async () => {
    mocks.adapter.stat.mockResolvedValueOnce({
      size: -1,
    });

    await expect(convertToBase64({
      id: 'a',
      path: '/vault/assets/invalid.png',
      previewUrl: 'blob:preview',
      assetUrl: '',
      name: 'invalid.png',
      type: 'image/png',
      size: 2,
    }, {
      allowPath: (path) => path.startsWith('/vault/'),
    })).rejects.toThrow('Cannot convert attachment to Base64');

    expect(mocks.adapter.stat).toHaveBeenCalledWith('/vault/assets/invalid.png');
    expect(mocks.adapter.readBinaryFile).not.toHaveBeenCalled();
  });

  it('reads allowed attachment paths when stat has no size but bounded read succeeds', async () => {
    mocks.adapter.stat.mockResolvedValueOnce({
      name: 'file.png',
      path: '/vault/assets/file.png',
      isDirectory: false,
      isFile: true,
    });

    await expect(convertToBase64({
      id: 'a',
      path: '/vault/assets/file.png',
      previewUrl: 'blob:preview',
      assetUrl: '',
      name: 'file.png',
      type: 'image/png',
      size: 2,
    }, {
      allowPath: (path) => path.startsWith('/vault/'),
    })).resolves.toBe('data:image/png;base64,SEk=');

    expect(mocks.adapter.stat).toHaveBeenCalledWith('/vault/assets/file.png');
    expect(mocks.adapter.readBinaryFile).toHaveBeenCalledWith('/vault/assets/file.png', MAX_ATTACHMENT_IMAGE_BYTES);
  });

  it('rejects oversized stored attachment URLs before reading them when stat has a size', async () => {
    mocks.adapter.stat.mockResolvedValueOnce({
      size: MAX_ATTACHMENT_IMAGE_BYTES + 1,
    });

    await expect(convertToBase64({
      id: 'a',
      path: '',
      previewUrl: 'attachment://huge.png',
      assetUrl: 'attachment://huge.png',
      name: 'huge.png',
      type: 'image/png',
      size: MAX_ATTACHMENT_IMAGE_BYTES + 1,
    })).rejects.toThrow('Attachment image is too large.');

    expect(mocks.adapter.stat).toHaveBeenCalledWith('/appdata/.vlaina/chat/attachments/huge.png');
    expect(mocks.adapter.readBinaryFile).not.toHaveBeenCalled();
  });

  it('rejects stored attachment URLs with invalid known stat sizes before reading them', async () => {
    mocks.adapter.stat.mockResolvedValueOnce({
      size: -1,
    });

    await expect(convertToBase64({
      id: 'a',
      path: '',
      previewUrl: 'attachment://invalid.png',
      assetUrl: 'attachment://invalid.png',
      name: 'invalid.png',
      type: 'image/png',
      size: 2,
    })).rejects.toThrow('Attachment image is too large.');

    expect(mocks.adapter.stat).toHaveBeenCalledWith('/appdata/.vlaina/chat/attachments/invalid.png');
    expect(mocks.adapter.readBinaryFile).not.toHaveBeenCalled();
  });

  it('reads stored attachment URLs when stat has no size but bounded read succeeds', async () => {
    mocks.adapter.stat.mockResolvedValueOnce(null);

    await expect(convertToBase64({
      id: 'a',
      path: '',
      previewUrl: 'attachment://file.png',
      assetUrl: 'attachment://file.png',
      name: 'file.png',
      type: 'image/png',
      size: 2,
    })).resolves.toBe('data:image/png;base64,SEk=');

    expect(mocks.adapter.stat).toHaveBeenCalledWith('/appdata/.vlaina/chat/attachments/file.png');
    expect(mocks.adapter.readBinaryFile).toHaveBeenCalledWith(
      '/appdata/.vlaina/chat/attachments/file.png',
      MAX_ATTACHMENT_IMAGE_BYTES,
    );
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
    expect(mocks.joinPath).toHaveBeenCalledWith('/appdata', '.vlaina', 'chat', 'attachments', 'demo image.png');
    expect(mocks.adapter.readBinaryFile).toHaveBeenCalledWith(
      '/appdata/.vlaina/chat/attachments/demo image.png',
      MAX_ATTACHMENT_IMAGE_BYTES,
    );
  });

  it('does not resolve remote attachment-looking asset URLs when converting to base64', async () => {
    await expect(convertToBase64({
      id: 'a',
      path: '',
      previewUrl: 'blob:preview',
      assetUrl: 'https://example.test/attachments/demo.png',
      name: 'demo.png',
      type: 'image/png',
      size: 2,
    })).rejects.toThrow('Cannot convert attachment to Base64');

    expect(mocks.adapter.getBasePath).not.toHaveBeenCalled();
    expect(mocks.adapter.readBinaryFile).not.toHaveBeenCalled();
  });

  it('does not delete local files from remote attachment-looking asset URLs', async () => {
    await deleteAttachment({
      id: 'a',
      path: '',
      previewUrl: 'blob:preview',
      assetUrl: 'https://example.test/attachments/demo.png',
      name: 'demo.png',
      type: 'image/png',
      size: 2,
    });

    expect(mocks.adapter.getBasePath).not.toHaveBeenCalled();
    expect(mocks.adapter.deleteFile).not.toHaveBeenCalled();
  });

});
