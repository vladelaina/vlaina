import { describe, expect, it, vi } from 'vitest';
import {
  getRelativeMarkdownThemeCssImports,
  rebaseRelativeMarkdownThemeCssUrls,
  sanitizeImportedMarkdownThemeCss,
  sanitizeUnsafeMarkdownThemeCssUrls,
} from './cssUrls';

vi.mock('@/lib/storage/adapter', () => ({
  getParentPath: (path: string) => path.replace(/[\\/][^\\/]*$/, '') || null,
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
  toFileUrl: (path: string) => Promise.resolve(`file://${path}`),
}));

describe('themeCssUrls', () => {
  it('rebases relative CSS asset URLs from the imported theme file directory', async () => {
    const rebased = await rebaseRelativeMarkdownThemeCssUrls(
      [
        '@font-face { src: url("./fonts/theme.woff2?version=1#main") format("woff2"); }',
        '.cover { background: url(images/cover (wide).png#preview); }',
      ].join('\n'),
      '/downloads/themes/Clean Light.css'
    );

    expect(rebased).toContain('url("file:///downloads/themes/./fonts/theme.woff2?version=1#main")');
    expect(rebased).toContain('url("file:///downloads/themes/images/cover (wide).png#preview")');
  });

  it('leaves non-relative and dynamic CSS URLs unchanged', async () => {
    const css = [
      '.remote { background: url(https://example.com/cover.png); }',
      '.data { background: url("data:image/svg+xml,%3Csvg%3E"); }',
      '.absolute { background: url("/images/cover.png"); }',
      '.custom { background: url(var(--cover-image)); }',
    ].join('\n');

    await expect(rebaseRelativeMarkdownThemeCssUrls(css, '/downloads/theme.css')).resolves.toBe(css);
  });

  it('does not rewrite CSS url() text inside strings or comments', async () => {
    const css = [
      '.literal::before { content: "url(./literal.png)"; }',
      '.unsafe::before { content: "url(javascript:alert(1))"; }',
      '/* url(./comment.png) */',
      '.real { background: url(./real.png); }',
    ].join('\n');

    const rebased = await rebaseRelativeMarkdownThemeCssUrls(css, '/downloads/theme.css');

    expect(rebased).toContain('content: "url(./literal.png)"');
    expect(rebased).toContain('content: "url(javascript:alert(1))"');
    expect(rebased).toContain('/* url(./comment.png) */');
    expect(rebased).toContain('url("file:///downloads/./real.png")');
    expect(rebased).not.toContain('file:///downloads/./literal.png');
    expect(rebased).not.toContain('file:///downloads/./comment.png');
  });

  it('does not treat longer CSS function names ending in url as url() tokens', async () => {
    const css = [
      '.custom { background: my-url(./literal.png); }',
      '.real { background: image-set(url(./real.png) 1x); }',
    ].join('\n');

    const rebased = await rebaseRelativeMarkdownThemeCssUrls(css, '/downloads/theme.css');

    expect(rebased).toContain('my-url(./literal.png)');
    expect(rebased).toContain('image-set(url("file:///downloads/./real.png") 1x)');
  });

  it('does not sanitize longer CSS function names ending in url as url() tokens', () => {
    const css = '.custom { background: my-url(javascript:alert(1)); }';

    expect(sanitizeUnsafeMarkdownThemeCssUrls(css)).toBe(css);
  });

  it('sanitizes unsafe CSS URL protocols without leaving broken parentheses behind', () => {
    expect(
      sanitizeUnsafeMarkdownThemeCssUrls(
        'a { background: url(javascript:alert(1)); } b { background: url("vbscript:msgbox(1)"); }'
      )
    ).toBe('a { background: url(""); } b { background: url(""); }');
  });

  it('sanitizes unsafe CSS URL protocols after CSS escape decoding', () => {
    expect(
      sanitizeUnsafeMarkdownThemeCssUrls(
        [
          '.escaped-name { background: url(ja\\000076ascript:alert(1)); }',
          '.space-terminated { background: url(ja\\76 ascript:alert(1)); }',
          '.escaped-colon { background: url("javascript\\3a alert(1)"); }',
          '.spaced { background: url("java script:alert(1)"); }',
        ].join('\n')
      )
    ).toBe([
      '.escaped-name { background: url(""); }',
      '.space-terminated { background: url(""); }',
      '.escaped-colon { background: url(""); }',
      '.spaced { background: url(""); }',
    ].join('\n'));
  });

  it('does not sanitize unsafe-looking CSS url() text inside strings or comments', () => {
    const css = [
      '.literal::before { content: "url(javascript:alert(1))"; }',
      '/* url(vbscript:msgbox(1)) */',
      '.real { background: url(javascript:alert(1)); }',
    ].join('\n');

    expect(sanitizeUnsafeMarkdownThemeCssUrls(css)).toBe([
      '.literal::before { content: "url(javascript:alert(1))"; }',
      '/* url(vbscript:msgbox(1)) */',
      '.real { background: url(""); }',
    ].join('\n'));
  });

  it('strips top-level CSS imports while preserving literal import text', () => {
    const css = [
      '@import url("https://example.com/theme.css");',
      '@IMPORT "./local.css";',
      '.literal::before { content: "@import url(./literal.css);"; }',
      '/* @import url("./comment.css"); */',
      '#write { color: red; }',
    ].join('\n');

    const sanitized = sanitizeImportedMarkdownThemeCss(css);

    expect(sanitized).not.toContain('@import url("https://example.com/theme.css")');
    expect(sanitized).not.toContain('@IMPORT "./local.css"');
    expect(sanitized).toContain('content: "@import url(./literal.css);"');
    expect(sanitized).toContain('/* @import url("./comment.css"); */');
    expect(sanitized).toContain('#write { color: red; }');
  });

  it('extracts only relative CSS imports for local theme dependency inlining', () => {
    const css = [
      '@import "vlook/pages-dev/fs-ink-min.css";',
      '@import url("./vlook/github-io/fs-ink-min.css") screen;',
      '@import url("https://example.com/remote.css");',
      '@import "./fonts/theme.woff2";',
      '.literal::before { content: "@import url(./literal.css);"; }',
      '/* @import "./comment.css"; */',
    ].join('\n');

    expect(getRelativeMarkdownThemeCssImports(css)).toEqual([
      {
        url: 'vlook/pages-dev/fs-ink-min.css',
        path: 'vlook/pages-dev/fs-ink-min.css',
        suffix: '',
      },
      {
        url: './vlook/github-io/fs-ink-min.css',
        path: './vlook/github-io/fs-ink-min.css',
        suffix: '',
      },
    ]);
  });
});
