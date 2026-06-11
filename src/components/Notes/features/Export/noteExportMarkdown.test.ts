import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_EXPORT_EMBEDDED_IMAGE_BYTES, resolveExportMarkdownAssetSources } from './noteExportMarkdown';

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
    mocks.stat.mockResolvedValue({
      name: 'demo.png',
      path: '/vault/docs/assets/demo.png',
      isDirectory: false,
      isFile: true,
      size: 2,
    });
    mocks.resolveExistingVaultAssetPath.mockReset();
  });

  it('embeds local note images as data URLs for portable exports', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
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
    expect(mocks.readBinaryFile).toHaveBeenCalledWith(
      '/vault/docs/assets/demo.png',
      MAX_EXPORT_EMBEDDED_IMAGE_BYTES,
    );
  });

  it('embeds case-insensitive internal note image refs as data URLs', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      '![demo](IMG:demo.png)',
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

  it('embeds supported bmp and avif note images as data URLs', async () => {
    mocks.resolveExistingVaultAssetPath
      .mockResolvedValueOnce('/vault/docs/assets/demo.bmp')
      .mockResolvedValueOnce('/vault/docs/assets/demo.avif');
    mocks.readBinaryFile
      .mockResolvedValueOnce(new Uint8Array([1, 2]))
      .mockResolvedValueOnce(new Uint8Array([3, 4]));

    const markdown = await resolveExportMarkdownAssetSources(
      [
        '![bmp](img:demo.bmp)',
        '![avif](img:demo.avif)',
      ].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '![bmp](data:image/bmp;base64,AQI=)',
      '![avif](data:image/avif;base64,AwQ=)',
    ].join('\n'));
  });

  it('does not resolve invalid internal note image refs as local files', async () => {
    const markdown = await resolveExportMarkdownAssetSources(
      '![demo](img:/vault/demo.png)',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![demo](img:/vault/demo.png)');
    expect(mocks.resolveExistingVaultAssetPath).not.toHaveBeenCalled();
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('does not resolve note image refs that point into internal notes folders', async () => {
    const markdown = await resolveExportMarkdownAssetSources(
      [
        '![vlaina](img:.vlaina/secret.png)',
        '<img src="img:docs/.git/secret.png" alt="git">',
        '![encoded vlaina](img:%2evlaina/secret.png)',
        '<img src="img:docs%2f.git%2fsecret.png" alt="encoded git">',
        '![user dot](img:.notes/public.png)',
        '![encoded user dot](img:%2enotes/public.png)',
      ].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '![vlaina](img:.vlaina/secret.png)',
      '<img src="img:docs/.git/secret.png" alt="git">',
      '![encoded vlaina](img:%2evlaina/secret.png)',
      '<img src="img:docs%2f.git%2fsecret.png" alt="encoded git">',
      '![user dot](img:.notes/public.png)',
      '![encoded user dot](img:%2enotes/public.png)',
    ].join('\n'));
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledTimes(2);
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenNthCalledWith(
      1,
      '/vault',
      '.notes/public.png',
      'docs/demo.md',
    );
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenNthCalledWith(
      2,
      '/vault',
      '%2enotes/public.png',
      'docs/demo.md',
    );
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('does not read resolved export image paths inside internal notes folders', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/.vlaina/assets/secret.png');

    const markdown = await resolveExportMarkdownAssetSources(
      '![secret](img:assets/secret.png)',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![secret](img:assets/secret.png)');
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'assets/secret.png',
      'docs/demo.md',
    );
    expect(mocks.stat).not.toHaveBeenCalled();
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('embeds markdown images with titles and angle-wrapped paths', async () => {
    mocks.resolveExistingVaultAssetPath
      .mockResolvedValueOnce('/vault/docs/assets/demo one.jpg')
      .mockResolvedValueOnce('/vault/docs/assets/demo two.webp');
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

  it('decodes markdown image target entities for local asset lookup', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      '![demo](img:path/with&amp;entity&#46;png "Entity")',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![demo](data:image/png;base64,aGk= "Entity")');
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'path/with&entity.png',
      'docs/demo.md',
    );
  });

  it('decodes markdown image target entity prefixes for local asset lookup', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      '![demo](img&colon;demo.png)',
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

  it('embeds only real markdown image targets with nested label text', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/real.png');
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

  it('does not embed html image tags inside markdown image labels as separate assets', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/real.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      '![<img src="img:alt.png">](img:real.png)',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![<img src="img:alt.png">](data:image/png;base64,aGk=)');
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledTimes(1);
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'real.png',
      'docs/demo.md',
    );
  });

  it('embeds markdown image targets with nested parentheses', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/real.png');
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
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/real.png');
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

  it('embeds angle-wrapped markdown image targets with escaped destination brackets', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/real.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      String.raw`![demo](<img:folder/real-\>.png>)`,
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![demo](<data:image/png;base64,aGk=>)');
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'folder/real->.png',
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
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
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
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
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

  it('does not rewrite image-like asset refs inside raw HTML pre blocks', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      [
        '<pre>',
        '![demo](img:demo.png)',
        '<img src="img:demo.png">',
        '</pre>',
        '',
        '![demo](img:demo.png)',
      ].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '<pre>',
      '![demo](img:demo.png)',
      '<img src="img:demo.png">',
      '</pre>',
      '',
      '![demo](data:image/png;base64,aGk=)',
    ].join('\n'));
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledTimes(1);
  });

  it('does not rewrite image-like asset refs inside raw HTML tags whose contents are dropped', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      [
        '<svg><image href="img:svg.png"></image></svg>',
        '<noscript><img src="img:noscript.png"></noscript>',
        '<math>![math](img:math.png)</math>',
        '',
        '![real](img:demo.png)',
      ].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '<svg><image href="img:svg.png"></image></svg>',
      '<noscript><img src="img:noscript.png"></noscript>',
      '<math>![math](img:math.png)</math>',
      '',
      '![real](data:image/png;base64,aGk=)',
    ].join('\n'));
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledTimes(1);
  });

  it('still embeds raw HTML image sources outside code blocks', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      '<div><img src="img:demo.png" alt="demo"></div>',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('<div><img src="data:image/png;base64,aGk=" alt="demo"></div>');
  });

  it('does not embed markdown image text inside raw HTML blocks', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      [
        '<div>',
        '![not-markdown](img:not-markdown.png)',
        '<img src="img:demo.png" alt="demo">',
        '</div>',
        '',
        '![real](img:demo.png)',
      ].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '<div>',
      '![not-markdown](img:not-markdown.png)',
      '<img src="data:image/png;base64,aGk=" alt="demo">',
      '</div>',
      '',
      '![real](data:image/png;base64,aGk=)',
    ].join('\n'));
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledTimes(1);
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'demo.png',
      'docs/demo.md',
    );
  });

  it('embeds only real src attributes from raw HTML image tags', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
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
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
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

  it('preserves raw HTML image attribute text when the local asset is unresolved', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('');

    const markdown = await resolveExportMarkdownAssetSources(
      '<img src=" img:missing.png " alt="missing">',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('<img src=" img:missing.png " alt="missing">');
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledWith(
      '/vault',
      'missing.png',
      'docs/demo.md',
    );
  });

  it('decodes numeric raw HTML image src entities for local asset lookup', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
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

  it('does not embed raw HTML source or video poster assets that export rendering drops', async () => {
    const markdown = await resolveExportMarkdownAssetSources(
      [
        '<picture><source srcset="img:a.webp 1x, img:a@2x.webp 2x"><img src="https://example.com/a.png"></picture>',
        '<video src="img:movie.mp4" poster="img:poster.png"></video>',
      ].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '<picture><source srcset="img:a.webp 1x, img:a@2x.webp 2x"><img src="https://example.com/a.png"></picture>',
      '<video src="img:movie.mp4" poster="img:poster.png"></video>',
    ].join('\n'));
    expect(mocks.resolveExistingVaultAssetPath).not.toHaveBeenCalled();
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('does not rewrite img-like payload text inside raw HTML data URL srcset candidates', async () => {
    const markdown = await resolveExportMarkdownAssetSources(
      '<picture><source srcset="data:image/svg+xml,img:a.webp 1x, img:a@2x.webp 2x"><img src="https://example.com/a.png"></picture>',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe(
      '<picture><source srcset="data:image/svg+xml,img:a.webp 1x, img:a@2x.webp 2x"><img src="https://example.com/a.png"></picture>',
    );
    expect(mocks.resolveExistingVaultAssetPath).not.toHaveBeenCalled();
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
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
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/huge.png');
    mocks.stat.mockResolvedValue({ size: 51 * 1024 * 1024 });

    const markdown = await resolveExportMarkdownAssetSources(
      '![huge](img:huge.png)',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![huge](img:huge.png)');
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('does not read local note images when stat has no size', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
    mocks.stat.mockResolvedValue(null);

    const markdown = await resolveExportMarkdownAssetSources(
      '![demo](img:demo.png)',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![demo](img:demo.png)');
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('does not inline non-image local note assets', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/secret.md');

    const markdown = await resolveExportMarkdownAssetSources(
      '![secret](img:secret.md)',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![secret](img:secret.md)');
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('does not inline local SVG note images as executable data URLs', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/icon.svg');

    const markdown = await resolveExportMarkdownAssetSources(
      '![icon](img:icon.svg)',
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe('![icon](img:icon.svg)');
    expect(mocks.readBinaryFile).not.toHaveBeenCalled();
  });

  it('does not let user-authored protected text collide with export segment markers', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));
    const markerLikeText = '\0vlaina-export-segment-0-0\0';

    const markdown = await resolveExportMarkdownAssetSources(
      [
        '```',
        markerLikeText,
        '```',
        '',
        '![demo](img:demo.png)',
      ].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '```',
      markerLikeText,
      '```',
      '',
      '![demo](data:image/png;base64,aGk=)',
    ].join('\n'));
  });

  it('resolves export markdown segments sequentially without changing replacements', async () => {
    let activeReads = 0;
    let maxActiveReads = 0;
    mocks.resolveExistingVaultAssetPath.mockImplementation(async (_notesPath, assetPath) =>
      `/vault/docs/assets/${assetPath}`,
    );
    mocks.readBinaryFile.mockImplementation(async () => {
      activeReads += 1;
      maxActiveReads = Math.max(maxActiveReads, activeReads);
      await Promise.resolve();
      activeReads -= 1;
      return new Uint8Array([104, 105]);
    });

    const markdown = await resolveExportMarkdownAssetSources(
      [
        '![one](img:one.png)',
        '```',
        'protected',
        '```',
        '![two](img:two.png)',
        '```',
        'protected',
        '```',
        '![three](img:three.png)',
      ].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '![one](data:image/png;base64,aGk=)',
      '```',
      'protected',
      '```',
      '![two](data:image/png;base64,aGk=)',
      '```',
      'protected',
      '```',
      '![three](data:image/png;base64,aGk=)',
    ].join('\n'));
    expect(maxActiveReads).toBe(1);
  });

  it('reuses resolved data URLs for repeated local note images during one export', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      [
        '![first](img:demo.png)',
        '<img src="img:demo.png" alt="second">',
        '![third](img:demo.png)',
      ].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '![first](data:image/png;base64,aGk=)',
      '<img src="data:image/png;base64,aGk=" alt="second">',
      '![third](data:image/png;base64,aGk=)',
    ].join('\n'));
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledTimes(1);
    expect(mocks.stat).toHaveBeenCalledTimes(1);
    expect(mocks.readBinaryFile).toHaveBeenCalledTimes(1);
  });

  it('keeps later image refs unresolved when embedded image budget is exhausted', async () => {
    mocks.resolveExistingVaultAssetPath.mockImplementation(async (_notesPath, assetPath) =>
      `/vault/docs/assets/${assetPath}`,
    );
    mocks.stat
      .mockResolvedValueOnce({ size: MAX_EXPORT_EMBEDDED_IMAGE_BYTES - 1 })
      .mockResolvedValueOnce({ size: 2 });
    mocks.readBinaryFile.mockResolvedValueOnce(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      ['![one](img:one.png)', '![two](img:two.png)'].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '![one](data:image/png;base64,aGk=)',
      '![two](img:two.png)',
    ].join('\n'));
    expect(mocks.readBinaryFile).toHaveBeenCalledTimes(1);
  });

  it('counts repeated cached data URL insertions against the embedded image budget', async () => {
    mocks.resolveExistingVaultAssetPath.mockResolvedValue('/vault/docs/assets/demo.png');
    mocks.stat.mockResolvedValue({ size: Math.floor(MAX_EXPORT_EMBEDDED_IMAGE_BYTES / 2) + 1 });
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([104, 105]));

    const markdown = await resolveExportMarkdownAssetSources(
      ['![one](img:demo.png)', '![two](img:demo.png)'].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '![one](data:image/png;base64,aGk=)',
      '![two](img:demo.png)',
    ].join('\n'));
    expect(mocks.resolveExistingVaultAssetPath).toHaveBeenCalledTimes(1);
    expect(mocks.stat).toHaveBeenCalledTimes(1);
    expect(mocks.readBinaryFile).toHaveBeenCalledTimes(1);
  });

  it('does not base64 encode images that read larger than the remaining embedded image budget', async () => {
    mocks.resolveExistingVaultAssetPath.mockImplementation(async (_notesPath, assetPath) =>
      `/vault/docs/assets/${assetPath}`,
    );
    mocks.stat
      .mockResolvedValueOnce({ size: MAX_EXPORT_EMBEDDED_IMAGE_BYTES - 2 })
      .mockResolvedValueOnce({ size: 2 });
    mocks.readBinaryFile
      .mockResolvedValueOnce(new Uint8Array([104, 105]))
      .mockResolvedValueOnce(new Uint8Array([1, 2, 3]));

    const markdown = await resolveExportMarkdownAssetSources(
      ['![one](img:one.png)', '![two](img:two.png)'].join('\n'),
      '/vault',
      'docs/demo.md',
    );

    expect(markdown).toBe([
      '![one](data:image/png;base64,aGk=)',
      '![two](img:two.png)',
    ].join('\n'));
    expect(mocks.readBinaryFile).toHaveBeenCalledTimes(2);
    expect(mocks.readBinaryFile).toHaveBeenNthCalledWith(
      1,
      '/vault/docs/assets/one.png',
      MAX_EXPORT_EMBEDDED_IMAGE_BYTES,
    );
    expect(mocks.readBinaryFile).toHaveBeenNthCalledWith(
      2,
      '/vault/docs/assets/two.png',
      2,
    );
  });
});
