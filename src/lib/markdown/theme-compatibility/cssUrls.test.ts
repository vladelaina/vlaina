import { describe, expect, it, vi } from 'vitest';
import {
  getRelativeMarkdownThemeCssImports,
  MAX_MARKDOWN_THEME_CSS_URL_REWRITE_CONCURRENCY,
  MAX_MARKDOWN_THEME_CSS_URL_TOKENS,
  MAX_MARKDOWN_THEME_CSS_URL_VALUE_CHARS,
  rebaseRelativeMarkdownThemeCssUrls,
  rewriteRelativeMarkdownThemeCssUrls,
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

  it('does not rewrite CSS-escaped absolute URL schemes as relative assets', async () => {
    const css = [
      String.raw`.remote { background: url("https\://example.com/cover.png"); }`,
      String.raw`.file { background: url(file\:///tmp/secret.png); }`,
      String.raw`.data { background: url(data\:image/png;base64,a); }`,
      String.raw`.absolute { background: url("\/images/cover.png"); }`,
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

  it('limits concurrent relative CSS URL rewrites while preserving token order', async () => {
    const urls = Array.from(
      { length: MAX_MARKDOWN_THEME_CSS_URL_REWRITE_CONCURRENCY + 3 },
      (_value, index) => `./asset-${index}.png`,
    );
    const css = urls.map((url, index) => `.item-${index} { background: url(${url}); }`).join('\n');
    let activeRewrites = 0;
    let maxActiveRewrites = 0;
    const resolveRewrites: Array<() => void> = [];

    const rewriteRequest = rewriteRelativeMarkdownThemeCssUrls(
      css,
      '/downloads/theme.css',
      async ({ path }) => {
        activeRewrites += 1;
        maxActiveRewrites = Math.max(maxActiveRewrites, activeRewrites);
        await new Promise<void>((resolve) => {
          resolveRewrites.push(resolve);
        });
        activeRewrites -= 1;
        return `file:///rewritten/${path}`;
      },
    );

    await vi.waitFor(() => {
      expect(resolveRewrites).toHaveLength(MAX_MARKDOWN_THEME_CSS_URL_REWRITE_CONCURRENCY);
    });
    expect(maxActiveRewrites).toBeLessThanOrEqual(MAX_MARKDOWN_THEME_CSS_URL_REWRITE_CONCURRENCY);
    for (let index = 0; index < MAX_MARKDOWN_THEME_CSS_URL_REWRITE_CONCURRENCY; index += 1) {
      resolveRewrites.shift()?.();
      await Promise.resolve();
    }
    await vi.waitFor(() => {
      expect(resolveRewrites).toHaveLength(urls.length - MAX_MARKDOWN_THEME_CSS_URL_REWRITE_CONCURRENCY);
    });
    while (resolveRewrites.length > 0) {
      resolveRewrites.shift()?.();
      await Promise.resolve();
    }

    const rewritten = await rewriteRequest;
    expect(maxActiveRewrites).toBeLessThanOrEqual(MAX_MARKDOWN_THEME_CSS_URL_REWRITE_CONCURRENCY);
    urls.forEach((url, index) => {
      expect(rewritten).toContain(`.item-${index} { background: url("file:///rewritten/${url}"); }`);
    });
  });

  it('drops relative CSS URLs when the resolver explicitly rejects them', async () => {
    const css = [
      '.dropped { background: url(./secret.png); }',
      '.unchanged { background: url(./literal.png); }',
    ].join('\n');

    const rewritten = await rewriteRelativeMarkdownThemeCssUrls(
      css,
      '/downloads/theme.css',
      async ({ path }) => (path.includes('secret') ? false : null),
    );

    expect(rewritten).toBe([
      '.dropped { background: url(""); }',
      '.unchanged { background: url(./literal.png); }',
    ].join('\n'));
  });

  it('bounds CSS URL tokens before rewriting theme assets', async () => {
    const css = Array.from(
      { length: MAX_MARKDOWN_THEME_CSS_URL_TOKENS + 2 },
      (_value, index) => `.item-${index} { background: url(./asset-${index}.png); }`,
    ).join('\n');
    const rewriteRequests: string[] = [];

    const rewritten = await rewriteRelativeMarkdownThemeCssUrls(
      css,
      '/downloads/theme.css',
      async ({ path }) => {
        rewriteRequests.push(path);
        return `file:///rewritten/${path}`;
      },
    );

    expect(rewriteRequests).toHaveLength(MAX_MARKDOWN_THEME_CSS_URL_TOKENS);
    expect(rewritten).toContain(`.item-${MAX_MARKDOWN_THEME_CSS_URL_TOKENS - 1} { background: url("file:///rewritten/./asset-${MAX_MARKDOWN_THEME_CSS_URL_TOKENS - 1}.png"); }`);
    expect(rewritten).toContain(`.item-${MAX_MARKDOWN_THEME_CSS_URL_TOKENS} { background: url(./asset-${MAX_MARKDOWN_THEME_CSS_URL_TOKENS}.png); }`);
  });

  it('handles many unclosed CSS url() functions without repeated tail scans', async () => {
    const css = Array.from(
      { length: 50_000 },
      (_value, index) => `.item-${index} { background: url(./asset-${index}.png; }`,
    ).join('\n');
    const rewriteRequests: string[] = [];

    await expect(
      rewriteRelativeMarkdownThemeCssUrls(
        css,
        '/downloads/theme.css',
        async ({ path }) => {
          rewriteRequests.push(path);
          return `file:///rewritten/${path}`;
        },
      )
    ).resolves.toBe(css);

    expect(rewriteRequests).toEqual([]);
  });

  it('continues URL sanitization after a malformed quoted url() value', () => {
    const css = [
      '.malformed { background: url("./asset.png" broken); }',
      '.unsafe { background: url(javascript:alert(1)); }',
    ].join('\n');

    expect(sanitizeUnsafeMarkdownThemeCssUrls(css)).toBe([
      '.malformed { background: url("./asset.png" broken); }',
      '.unsafe { background: url(""); }',
    ].join('\n'));
  });

  it('sanitizes oversized unsafe CSS URL values', () => {
    const oversizedUnsafeUrl = `javascript:${'a'.repeat(MAX_MARKDOWN_THEME_CSS_URL_VALUE_CHARS + 1)}`;
    const oversizedRelativeUrl = `./${'a'.repeat(MAX_MARKDOWN_THEME_CSS_URL_VALUE_CHARS + 1)}.png`;
    const css = [
      `.oversized-unsafe { background: url("${oversizedUnsafeUrl}"); }`,
      `.oversized-relative { background: url("${oversizedRelativeUrl}"); }`,
      '.safe { background: url(javascript:alert(1)); }',
    ].join('\n');

    const sanitized = sanitizeUnsafeMarkdownThemeCssUrls(css);

    expect(sanitized).toContain('.oversized-unsafe { background: url(""); }');
    expect(sanitized).toContain(`url("${oversizedRelativeUrl}")`);
    expect(sanitized).toContain('.safe { background: url(""); }');
  });

  it('does not rewrite oversized CSS URL values', async () => {
    const oversizedRelativeUrl = `./${'a'.repeat(MAX_MARKDOWN_THEME_CSS_URL_VALUE_CHARS + 1)}.png`;
    const css = `.oversized { background: url("${oversizedRelativeUrl}"); }`;
    const rewriteRequests: string[] = [];

    const rewritten = await rewriteRelativeMarkdownThemeCssUrls(
      css,
      '/downloads/theme.css',
      async ({ path }) => {
        rewriteRequests.push(path);
        return `file:///rewritten/${path}`;
      },
    );

    expect(rewriteRequests).toEqual([]);
    expect(rewritten).toBe(css);
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
        'a { background: url(javascript:alert(1)); } b { background: url("vbscript:msgbox(1)"); } c { background: url(file:///tmp/secret.png); }'
      )
    ).toBe('a { background: url(""); } b { background: url(""); } c { background: url(""); }');
  });

  it('sanitizes unsafe CSS URL protocols after CSS escape decoding', () => {
    expect(
      sanitizeUnsafeMarkdownThemeCssUrls(
        [
          '.escaped-name { background: url(ja\\000076ascript:alert(1)); }',
          '.space-terminated { background: url(ja\\76 ascript:alert(1)); }',
          '.escaped-colon { background: url("javascript\\3a alert(1)"); }',
          String.raw`.escaped-file { background: url("file\3a ///tmp/secret.png"); }`,
          '.spaced { background: url("java script:alert(1)"); }',
        ].join('\n')
      )
    ).toBe([
      '.escaped-name { background: url(""); }',
      '.space-terminated { background: url(""); }',
      '.escaped-colon { background: url(""); }',
      '.escaped-file { background: url(""); }',
      '.spaced { background: url(""); }',
    ].join('\n'));
  });

  it('preserves managed cached theme file URLs while dropping file URL traversal', () => {
    const css = [
      '.cached { src: url("file:///app/.vlaina/app/cache/markdown-themes/theme-assets/0-font.woff2"); }',
      '.escaped-cache { src: url("file\\3a ///app/.vlaina/app/cache/markdown-themes/theme-assets/1-font.woff2"); }',
      '.traversal { src: url("file:///app/.vlaina/app/cache/markdown-themes/../secret.woff2"); }',
      '.outside { src: url("file:///tmp/secret.woff2"); }',
    ].join('\n');

    expect(sanitizeUnsafeMarkdownThemeCssUrls(css)).toBe([
      '.cached { src: url("file:///app/.vlaina/app/cache/markdown-themes/theme-assets/0-font.woff2"); }',
      '.escaped-cache { src: url("file\\3a ///app/.vlaina/app/cache/markdown-themes/theme-assets/1-font.woff2"); }',
      '.traversal { src: url(""); }',
      '.outside { src: url(""); }',
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

  it('strips CSS imports and sanitizes URLs when imported CSS is malformed', () => {
    const css = [
      '@import url("https://example.com/theme.css");',
      '.literal::before { content: "@import url(./literal.css);"; }',
      '/* @import url("./comment.css"); */',
      '#write { background: url(javascript:alert(1));',
    ].join('\n');

    const sanitized = sanitizeImportedMarkdownThemeCss(css);

    expect(sanitized).not.toContain('@import url("https://example.com/theme.css")');
    expect(sanitized).toContain('content: "@import url(./literal.css);"');
    expect(sanitized).toContain('/* @import url("./comment.css"); */');
    expect(sanitized).toContain('#write { background: url("");');
  });

  it('extracts only relative CSS imports for local theme dependency inlining', () => {
    const css = [
      '@import "vlook/pages-dev/fs-ink-min.css";',
      '@import url("./vlook/github-io/fs-ink-min.css") screen;',
      '@import url("https://example.com/remote.css");',
      String.raw`@import "https\://example.com/escaped-remote.css";`,
      String.raw`@import url("file\:///tmp/escaped-file.css");`,
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

  it('returns no relative imports when imported CSS is malformed', () => {
    expect(getRelativeMarkdownThemeCssImports('@import "./local.css";\n#write { color: red')).toEqual([]);
  });
});
