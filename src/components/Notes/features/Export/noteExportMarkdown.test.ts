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

  it('embeds only real markdown image targets with nested label text', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/real.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      '![outer [nested](img:not-target.png)](img:real.png "Real (1)")',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![outer [nested](img:not-target.png)](data:image/png;base64,aGk= "Real (1)")');
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledTimes(1);
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'real.png',
      'docs/demo.md',
    );
  });

  it('embeds markdown image targets with nested parentheses', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/real.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      '![demo](img:folder/real(1).png)',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![demo](data:image/png;base64,aGk=)');
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'folder/real(1).png',
      'docs/demo.md',
    );
  });

  it('embeds markdown image targets with escaped destination parentheses', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/real.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      String.raw`![demo](img:folder/real-\).png "Escaped")`,
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![demo](data:image/png;base64,aGk= "Escaped")');
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'folder/real-).png',
      'docs/demo.md',
    );
  });

  it('preserves escaped markdown image targets when the local asset is unresolved', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('');

    const markdown = await resolveExportMarkdownAssetSources(
      String.raw`![missing](img:folder/missing-\).png "Missing")`,
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe(String.raw`![missing](img:folder/missing-\).png "Missing")`);
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'folder/missing-).png',
      'docs/demo.md',
    );
  });

  it('does not rewrite markdown image examples inside code fences', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      [
        '```md',
        '![demo](img:demo.png)',
        '```',
        '',
        '![demo](img:demo.png)',
      ].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '```md',
      '![demo](img:demo.png)',
      '```',
      '',
      '![demo](data:image/png;base64,aGk=)',
    ].join('\n'));
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledTimes(1);
  });

  it('does not rewrite image-like asset refs inside inline code, escapes, comments, or raw text HTML', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      [
        '`![demo](img:demo.png) <img src="img:demo.png">`',
        '\\![demo](img:demo.png)',
        '<!-- <img src="img:demo.png"> -->',
        '<script>const html = \'<img src="img:demo.png">\';</script>',
        '![demo](img:demo.png)',
      ].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '`![demo](img:demo.png) <img src="img:demo.png">`',
      '\\![demo](img:demo.png)',
      '<!-- <img src="img:demo.png"> -->',
      '<script>const html = \'<img src="img:demo.png">\';</script>',
      '![demo](data:image/png;base64,aGk=)',
    ].join('\n'));
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledTimes(1);
  });

  it('still embeds raw HTML image sources outside code blocks', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      '<div><img src="img:demo.png" alt="demo"></div>',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('<div><img src="data:image/png;base64,aGk=" alt="demo"></div>');
  });

  it('embeds only real src attributes from raw HTML image tags', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      [
        '<img data-src="img:lazy.png" alt="not loaded">',
        '<img src="img:path/with>char.png" alt="quoted">',
      ].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '<img data-src="img:lazy.png" alt="not loaded">',
      '<img src="data:image/png;base64,aGk=" alt="quoted">',
    ].join('\n'));
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledTimes(1);
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'path/with>char.png',
      'docs/demo.md',
    );
  });

  it('decodes raw HTML image src entities for local asset lookup', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      '<img src="img:path/with&amp;entity.png" alt="quoted">',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('<img src="data:image/png;base64,aGk=" alt="quoted">');
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'path/with&entity.png',
      'docs/demo.md',
    );
  });

  it('decodes numeric raw HTML image src entities for local asset lookup', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      '<img src="img:path/with&#x2f;entity&#46;png" alt="quoted">',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('<img src="data:image/png;base64,aGk=" alt="quoted">');
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'path/with/entity.png',
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
