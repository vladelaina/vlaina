import { describe, expect, it, vi } from 'vitest';

import { requestManagedWebJson } from './webRequests';

describe('managed web request error body cancellation', () => {
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
});
