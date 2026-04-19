import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { sanitizeHtml, SANDBOXED_IFRAME_SANDBOX } from './sanitizer';

describe('sanitizeHtml', () => {
  it('removes script tags and inline event handlers', () => {
    const result = sanitizeHtml(
      '<img src="https://example.com/a.png" onerror="alert(1)"><script>alert(1)</script><p onload="evil()">ok</p>',
    );

    expect(result).toContain('<img src="https://example.com/a.png">');
    expect(result).toContain('<p>ok</p>');
    expect(result).not.toContain('script');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('alert(1)');
  });

  it('removes class id and data attributes', () => {
    const result = sanitizeHtml(
      '<p class="x" id="y" data-test="z">safe</p><iframe src="https://example.com/embed" data-token="1"></iframe>',
    );

    expect(result).toContain('<p>safe</p>');
    expect(result).toContain('<iframe');
    expect(result).not.toContain('class=');
    expect(result).not.toContain('id=');
    expect(result).not.toContain('data-test');
    expect(result).not.toContain('data-token');
  });

  it('hardens iframe embeds with sandbox and strips srcdoc', () => {
    const result = sanitizeHtml(
      '<iframe src="https://example.com/embed" srcdoc="<script>alert(1)</script>" allowfullscreen></iframe>',
    );

    expect(result).toContain('<iframe');
    expect(result).toContain(`sandbox="${SANDBOXED_IFRAME_SANDBOX}"`);
    expect(result).toContain('referrerpolicy="no-referrer"');
    expect(result).toContain('loading="lazy"');
    expect(result).toContain('allowfullscreen=""');
    expect(result).not.toContain('srcdoc');
  });

  it('rejects dangerous iframe sources including javascript and localhost', () => {
    expect(sanitizeHtml('<iframe src="javascript:alert(1)"></iframe>')).toBe('');
    expect(sanitizeHtml('<iframe src="http://localhost:3000/embed"></iframe>')).toBe('');
    expect(sanitizeHtml('<iframe src="http://127.0.0.1:3000/embed"></iframe>')).toBe('');
  });

  it('rejects dangerous links and image sources', () => {
    const result = sanitizeHtml(
      '<a href="javascript:alert(1)" target="_blank">bad</a><img src="javascript:alert(1)"><a href="#anchor">anchor</a>',
    );

    expect(result).toContain('<a>bad</a>');
    expect(result).toContain('<a href="#anchor">anchor</a>');
    expect(result).not.toContain('<img');
    expect(result).not.toContain('javascript:');
  });

  it('adds noopener metadata to external blank links', () => {
    const result = sanitizeHtml('<a href="https://example.com" target="_blank">safe</a>');

    expect(result).toContain('href="https://example.com/"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('blocks protocol obfuscation attempts in links and iframes', () => {
    const result = sanitizeHtml([
      '<a href="JaVaScRiPt:alert(1)">mixed-case</a>',
      '<a href="java&#x73;cript:alert(1)">entity</a>',
      '<iframe src="java&#x73;cript:alert(1)"></iframe>',
      '<iframe src="HTTPS://example.com/embed"></iframe>',
    ].join(''));

    expect(result).toContain('<a>mixed-case</a>');
    expect(result).toContain('<a>entity</a>');
    expect(result).toContain('<iframe src="https://example.com/embed"');
    expect(result).not.toContain('javascript:');
  });

  it('drops unsafe data urls and svg payloads from images', () => {
    const result = sanitizeHtml([
      '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">',
      '<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+">',
      '<img src="data:image/png;base64,QUJDRA==">',
    ].join(''));

    expect(result).toContain('<img src="data:image/png;base64,QUJDRA==">');
    expect(result).not.toContain('data:text/html');
    expect(result).not.toContain('image/svg+xml');
  });

  it('keeps safe structure while stripping unsupported wrapper tags', () => {
    const result = sanitizeHtml('<section><div><p>text <strong>bold</strong></p></div></section>');

    expect(result).toBe('<p>text <strong>bold</strong></p>');
  });

  it('strips sandbox escalation attributes from pasted iframes', () => {
    const result = sanitizeHtml(
      '<iframe src="https://example.com/embed" sandbox="allow-same-origin allow-top-navigation" class="x"></iframe>',
    );

    expect(result).toContain(`sandbox="${SANDBOXED_IFRAME_SANDBOX}"`);
    expect(result).not.toContain('allow-same-origin');
    expect(result).not.toContain('allow-top-navigation');
    expect(result).not.toContain('class=');
  });

  it('rejects local-network iframe targets that would reach device services', () => {
    expect(sanitizeHtml('<iframe src="http://0.0.0.0:8080/embed"></iframe>')).toBe('');
    expect(sanitizeHtml('<iframe src="http://[::1]:8080/embed"></iframe>')).toBe('');
  });

  it('removes event handlers regardless of casing', () => {
    const result = sanitizeHtml('<img src="https://example.com/a.png" oNlOaD="alert(1)"><p OnClIcK="evil()">x</p>');

    expect(result).toBe('<img src="https://example.com/a.png"><p>x</p>');
  });

  it('rejects iframe targets on private network ranges', () => {
    expect(sanitizeHtml('<iframe src="http://10.0.0.5/embed"></iframe>')).toBe('');
    expect(sanitizeHtml('<iframe src="http://172.20.10.4/embed"></iframe>')).toBe('');
    expect(sanitizeHtml('<iframe src="http://192.168.1.8/embed"></iframe>')).toBe('');
    expect(sanitizeHtml('<iframe src="http://169.254.10.2/embed"></iframe>')).toBe('');
    expect(sanitizeHtml('<iframe src="http://[fe80::1]/embed"></iframe>')).toBe('');
    expect(sanitizeHtml('<iframe src="http://[fd12:3456:789a::1]/embed"></iframe>')).toBe('');
  });

  it('rejects control and bidi characters in urls', () => {
    expect(sanitizeHtml('<a href="java\u0000script:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeHtml('<a href="https://example.com/\u202Ecod.exe">x</a>')).toBe('<a>x</a>');
    expect(sanitizeHtml('<iframe src="https://example.com/\u0000embed"></iframe>')).toBe('');
  });

  it('unwraps nested unsafe nodes without preserving dangerous descendants', () => {
    const result = sanitizeHtml('<custom><custom><script>alert(1)</script><p>safe</p></custom></custom>');

    expect(result).toBe('<p>safe</p>');
  });

  it('keeps safe iframe attributes while discarding forbidden ones', () => {
    const result = sanitizeHtml(
      '<iframe src="https://example.com/embed" width="800" height="600" frameborder="0" allow="fullscreen" scrolling="no" data-x="1" style="border:0"></iframe>',
    );

    expect(result).toContain('width="800"');
    expect(result).toContain('height="600"');
    expect(result).toContain('frameborder="0"');
    expect(result).toContain('allow="fullscreen"');
    expect(result).toContain('scrolling="no"');
    expect(result).not.toContain('data-x');
    expect(result).not.toContain('style=');
  });

  it('sanitizes realistic rich-html clipboard fragments from web pages', () => {
    const result = sanitizeHtml(`
      <div class="article" data-block="hero">
        <h2 id="headline">Title</h2>
        <p style="color:red" onclick="evil()">copy <strong>this</strong> <a href="https://example.com/post" target="_blank" data-track="1">link</a></p>
        <figure class="media">
          <img src="https://example.com/a.png" alt="cover" width="1200" onerror="alert(1)">
          <figcaption>caption</figcaption>
        </figure>
        <iframe src="https://example.com/embed" sandbox="allow-same-origin allow-scripts" style="border:0"></iframe>
      </div>
    `);

    expect(result).toContain('<h2>Title</h2>');
    expect(result).toContain('<p>copy <strong>this</strong> <a href="https://example.com/post" target="_blank" rel="noopener noreferrer">link</a></p>');
    expect(result).toContain('<img src="https://example.com/a.png" alt="cover">');
    expect(result).toContain('caption');
    expect(result).toContain(`sandbox="${SANDBOXED_IFRAME_SANDBOX}"`);
    expect(result).not.toContain('class=');
    expect(result).not.toContain('id=');
    expect(result).not.toContain('data-');
    expect(result).not.toContain('style=');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onerror');
  });

  it('sanitizes office-style pasted html without preserving executable payloads', () => {
    const result = sanitizeHtml(`
      <html>
        <body>
          <!--StartFragment-->
          <p class="MsoNormal">Hello <span style="font-weight:bold">world</span></p>
          <o:p>meta wrapper</o:p>
          <xml><script>alert(1)</script></xml>
          <!--EndFragment-->
        </body>
      </html>
    `);

    expect(result).toContain('<p>Hello world</p>');
    expect(result).toContain('meta wrapper');
    expect(result).not.toContain('script');
    expect(result).not.toContain('class=');
    expect(result).not.toContain('style=');
    expect(result).not.toContain('xml');
  });

  it('remains safe under deep nested wrappers with repeated dangerous attributes', () => {
    const payload = Array.from({ length: 80 }, (_, index) =>
      `<div class="x${index}" data-x="${index}" onclick="evil(${index})">`
    ).join('') + '<p id="target">deep</p>' + '</div>'.repeat(80);

    const result = sanitizeHtml(payload);

    expect(result).toBe('<p>deep</p>');
  });

  it('never leaves inline event attributes in sanitized output for generated attribute names', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{3,10}$/),
        (suffix) => {
          const attribute = `on${suffix}`;
          const html = `<p ${attribute}="alert(1)" class="x" data-y="1">safe</p>`;
          const result = sanitizeHtml(html);
          expect(result).toBe('<p>safe</p>');
          expect(result.toLowerCase()).not.toContain(`on${suffix.toLowerCase()}=`);
        },
      ),
      { numRuns: 50 },
    );
  });
});
