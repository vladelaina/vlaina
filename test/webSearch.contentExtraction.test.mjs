import { describe, expect, it } from 'vitest';
import { extractReadableContent } from '../electron/webSearch/contentExtraction.mjs';

describe('content extraction', () => {
  it('strips scripts, navigation, and html tags from readable content', () => {
    const page = extractReadableContent(`
      <html>
        <head><title>Example</title><script>bad()</script></head>
        <body>
          <nav>Menu</nav>
          <article>
            <h1>Heading</h1>
            <div class="ad-banner">Buy this now</div>
            <section id="sponsored-card">Sponsored story</section>
            <div aria-label="newsletter popup">Subscribe now</div>
            <p>Useful paragraph.</p>
          </article>
        </body>
      </html>
    `, 'https://example.com');

    expect(page.title).toBe('Example');
    expect(page.content).toContain('Heading');
    expect(page.content).toContain('Useful paragraph.');
    expect(page.content).not.toContain('bad()');
    expect(page.content).not.toContain('Menu');
    expect(page.content).not.toContain('Buy this now');
    expect(page.content).not.toContain('Sponsored story');
    expect(page.content).not.toContain('Subscribe now');
  });
});
