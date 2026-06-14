import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestManagedWebJson } from './webRequests';

describe('managed web request error body cancellation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cancels and releases managed error body readers when the external signal aborts', async () => {
    const controller = new AbortController();
    const reader = {
      read: vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>(() => undefined)),
      cancel: vi.fn(async () => undefined),
      releaseLock: vi.fn(),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      body: {
        getReader: () => reader,
      },
    }));

    const request = requestManagedWebJson('/models', {
      method: 'GET',
      signal: controller.signal,
    });
    request.catch(() => undefined);

    await vi.waitFor(() => expect(reader.read).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(reader.cancel).toHaveBeenCalledTimes(1);
    expect(reader.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('does not coerce request methods while deciding retry behavior', async () => {
    const method = {
      toString() {
        throw new Error('method should not be coerced');
      },
      [Symbol.toPrimitive]() {
        throw new Error('method should not be coerced');
      },
    };
    const networkError = new Error('network down');
    const fetchMock = vi.fn().mockRejectedValue(networkError);
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestManagedWebJson('/models', { method: method as unknown as string }))
      .rejects.toBe(networkError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores invalid content-length syntax before reading JSON bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-length': '1e12' },
      }),
    ));

    await expect(requestManagedWebJson('/models')).resolves.toEqual({ ok: true });
  });
});
