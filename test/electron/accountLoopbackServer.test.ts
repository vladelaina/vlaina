import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../electron/accountLoopbackServer.mjs';

describe('desktop auth loopback server', () => {
  it('escapes callback error text before rendering HTML', () => {
    expect(escapeHtml('<script>alert("x")</script>&\'')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;',
    );
  });
});
