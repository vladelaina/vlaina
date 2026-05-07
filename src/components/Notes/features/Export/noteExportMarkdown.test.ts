import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveExportMarkdownAssetSources } from './noteExportMarkdown';

const mocks = vi.hoisted(() => ({
  readBinaryFile: vi.fn(),
  stat: vi.fn(),
  resolveExistingVaultAssetPath: vi.fn(),
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => ({
    fs: {
      readBinaryFile: mocks.readBinaryFile,
      stat: mocks.stat,
    },
  }),
}));

vi.mock('@/lib/assets/core/paths', () => ({
  resolveExistingVaultAssetPath: mocks.resolveExistingVaultAssetPath,
}));

describe('resolveExportMarkdownAssetSources', () => {
  beforeEach(() => {
    mocks.readBinaryFile.mockReset();
    mocks.stat.mockReset();
    mocks.stat.mockResolvedValue(null);
    mocks.resolveExistingVaultAssetPath.mockReset();
  });

  it('embeds local note images as data URLs for portable exports', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      '![demo](img:demo.png)',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![demo](data:image/png;base64,aGk=)');
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'demo.png',
      'docs/demo.md',
    );
  });

  it('embeds markdown images with titles and angle-wrapped paths', async () => {
    mocks.resolveExistingVaultAssetPath
      .mockResolvedValueOnce('/vault/.vlaina/assets/demo one.jpg')
      .mockResolvedValueOnce('/vault/.vlaina/assets/demo two.webp');
    mocks.readBinaryFile
      .mockResolvedValueOnce(new Uint8Array([1, 2]))
      .mockResolvedValueOnce(new Uint8Array([3, 4]));

    const markdown = await resolveExportMarkdownAssetSources(
      [
        '![one](img:demo-one.jpg "One")',
        '![two](<img:demo two.webp>)',
      ].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '![one](data:image/jpeg;base64,AQI= "One")',
      '![two](<data:image/webp;base64,AwQ=>)',
    ].join('\n'));
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenNthCalledWith(
      1,
      '/vault',
      'demo-one.jpg',
      'docs/demo.md',
    );
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenNthCalledWith(
      2,
      '/vault',
      'demo two.webp',
      'docs/demo.md',
    );
  });

  it('keeps unresolved local note images instead of failing the export', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('');

    const markdown = await resolveExportMarkdownAssetSources(
      '![missing](img:missing.png)',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![missing](img:missing.png)');
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('does not inline oversized local note images', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/huge.png');
    mocks.stat.mockResolvedValue({ size: 51 * 1024 * 1024 });

    const markdown = await resolveExportMarkdownAssetSources(
      '![huge](img:huge.png)',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![huge](img:huge.png)');
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('does not inline non-image local note assets', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/secret.md');

    const markdown = await resolveExportMarkdownAssetSources(
      '![secret](img:secret.md)',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![secret](img:secret.md)');
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });
});
