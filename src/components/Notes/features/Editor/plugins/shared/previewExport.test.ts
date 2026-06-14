import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PREVIEW_EXPORT_BYTES, savePreview } from './previewExport';

const mocks = vi.hoisted(() => ({
  getBase64DecodedByteLength: vi.fn(),
  getElectronBridge: vi.fn(),
  saveDialog: vi.fn(),
  toJpeg: vi.fn(),
  toPng: vi.fn(),
  toSvg: vi.fn(),
  writeDesktopBinaryFile: vi.fn(),
}));

vi.mock('html-to-image', () => ({
  toJpeg: mocks.toJpeg,
  toPng: mocks.toPng,
  toSvg: mocks.toSvg,
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: mocks.getElectronBridge,
}));

vi.mock('@/lib/desktop/fs', () => ({
  writeDesktopBinaryFile: mocks.writeDesktopBinaryFile,
}));

vi.mock('@/lib/storage/dialog', () => ({
  saveDialog: mocks.saveDialog,
}));

vi.mock('@/lib/i18n', () => ({
  translate: (key: string, values?: Record<string, string>) => `${key}:${values?.format ?? ''}`,
}));

vi.mock('@/lib/markdown/dataImagePolicy', () => ({
  getBase64DecodedByteLength: mocks.getBase64DecodedByteLength,
}));

function decodeWrittenBytes(): string {
  const bytes = mocks.writeDesktopBinaryFile.mock.calls[0]?.[1] as Uint8Array | undefined;
  if (!bytes) {
    throw new Error('Missing written bytes');
  }
  return new TextDecoder().decode(bytes);
}

describe('savePreview', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mocks.getBase64DecodedByteLength.mockReset();
    mocks.getElectronBridge.mockReset();
    mocks.saveDialog.mockReset();
    mocks.toJpeg.mockReset();
    mocks.toPng.mockReset();
    mocks.toSvg.mockReset();
    mocks.writeDesktopBinaryFile.mockReset();

    mocks.getBase64DecodedByteLength.mockImplementation((payload: string) => {
      if (payload.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) {
        return null;
      }
      let padding = 0;
      if (payload.endsWith('==')) padding = 2;
      else if (payload.endsWith('=')) padding = 1;
      return Math.floor((payload.length * 3) / 4) - padding;
    });
    mocks.getElectronBridge.mockReturnValue({});
    mocks.saveDialog.mockImplementation(async (options: { defaultPath: string }) => `/tmp/${options.defaultPath}`);
    mocks.toJpeg.mockResolvedValue('data:image/jpeg;base64,anBn');
    mocks.toPng.mockResolvedValue('data:image/png;base64,cG5n');
    mocks.toSvg.mockResolvedValue('data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E');
    mocks.writeDesktopBinaryFile.mockResolvedValue(undefined);
  });

  it('sanitizes an existing SVG before writing it to disk', async () => {
    const element = document.createElement('div');
    element.innerHTML = [
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">',
      '<script>alert(1)</script>',
      '<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>',
      '<image href="https://example.test/a.png" xlink:href="https://example.test/b.png"></image>',
      '<rect filter="url(https://example.test/filter.svg#drop)" fill="url(#local-fill)"></rect>',
      '<text style="fill:url(#local-fill); stroke:url(https://example.test/stroke.svg#x); opacity:.8">safe</text>',
      '<circle cx="1" cy="1" r="1"></circle>',
      '</svg>',
    ].join('');

    await savePreview(element, 'diagram', 'svg');

    expect(mocks.toSvg).not.toHaveBeenCalled();
    expect(mocks.writeDesktopBinaryFile.mock.calls[0]?.[0]).toBe('/tmp/diagram.svg');
    const output = decodeWrittenBytes();
    expect(output).toContain('<svg');
    expect(output).toContain('<circle');
    expect(output).toContain('url(#local-fill)');
    expect(output).not.toContain('<script');
    expect(output).not.toContain('foreignObject');
    expect(output).not.toContain('javascript:');
    expect(output).not.toContain('example.test');
    expect(output).not.toContain('onload');
  });

  it('sanitizes html-to-image SVG output before writing it to disk', async () => {
    const element = document.createElement('div');
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg">',
      '<script>alert(1)</script>',
      '<image href="https://example.test/a.png"></image>',
      '<circle cx="1" cy="1" r="1"></circle>',
      '</svg>',
    ].join('');
    mocks.toSvg.mockResolvedValueOnce(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

    await savePreview(element, 'diagram', 'svg');

    expect(mocks.toSvg).toHaveBeenCalledWith(element, { cacheBust: true });
    const output = decodeWrittenBytes();
    expect(output).toContain('<circle');
    expect(output).not.toContain('<script');
    expect(output).not.toContain('example.test');
  });

  it('does not save raster exports when html-to-image returns the wrong MIME type', async () => {
    const element = document.createElement('div');
    mocks.toPng.mockResolvedValueOnce('data:text/html;base64,PHNjcmlwdD4=');

    await expect(savePreview(element, 'diagram', 'png')).rejects.toThrow('Unexpected preview export MIME type.');

    expect(mocks.saveDialog).not.toHaveBeenCalled();
    expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
  });

  it('does not save oversized raster preview output', async () => {
    const element = document.createElement('div');
    mocks.toPng.mockResolvedValueOnce('data:image/png;base64,cG5n');
    mocks.getBase64DecodedByteLength.mockReturnValueOnce(Number.MAX_SAFE_INTEGER);

    await expect(savePreview(element, 'diagram', 'png')).rejects.toThrow('Preview export output is too large.');

    expect(mocks.saveDialog).not.toHaveBeenCalled();
    expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
  });

  it('does not save oversized html-to-image SVG output', async () => {
    const element = document.createElement('div');
    mocks.toSvg.mockResolvedValueOnce('data:image/svg+xml;base64,PHN2Zz4=');
    mocks.getBase64DecodedByteLength.mockReturnValueOnce(Number.MAX_SAFE_INTEGER);

    await expect(savePreview(element, 'diagram', 'svg')).rejects.toThrow('Preview export output is too large.');

    expect(mocks.saveDialog).not.toHaveBeenCalled();
    expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
  });

  it('does not save oversized existing SVG output after serialization', async () => {
    const element = document.createElement('div');
    element.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="1" cy="1" r="1"></circle></svg>';
    const originalEncode = TextEncoder.prototype.encode;
    const encodeSpy = vi.spyOn(TextEncoder.prototype, 'encode').mockImplementation(function encode(this: TextEncoder, value?: string) {
      if (value?.startsWith('<?xml version=')) {
        return { byteLength: MAX_PREVIEW_EXPORT_BYTES + 1 } as Uint8Array;
      }
      return originalEncode.call(this, value);
    });

    try {
      await expect(savePreview(element, 'diagram', 'svg')).rejects.toThrow('Preview export output is too large.');
    } finally {
      encodeSpy.mockRestore();
    }

    expect(mocks.saveDialog).not.toHaveBeenCalled();
    expect(mocks.writeDesktopBinaryFile).not.toHaveBeenCalled();
  });
});
