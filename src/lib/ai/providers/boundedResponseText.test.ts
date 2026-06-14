import { describe, expect, it } from 'vitest';

import {
  readBoundedProviderJsonResponse,
  readBoundedProviderResponseText,
} from './boundedResponseText';

describe('bounded provider response text', () => {
  it('ignores invalid content-length syntax for bounded text reads', async () => {
    const response = new Response('ok', {
      headers: { 'content-length': '1e12' },
    });

    await expect(readBoundedProviderResponseText(response, undefined, 'fallback', 16))
      .resolves.toBe('ok');
  });

  it('ignores invalid content-length syntax for bounded JSON reads', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-length': '1e12' },
    });

    await expect(readBoundedProviderJsonResponse(response)).resolves.toEqual({ ok: true });
  });
});
