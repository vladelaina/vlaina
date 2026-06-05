import { describe, expect, it, vi } from 'vitest';
import { readBoundedJsonResponse } from '../../electron/boundedJsonResponse.mjs';

describe('bounded JSON response reader', () => {
  it('parses JSON responses within the byte limit', async () => {
    await expect(readBoundedJsonResponse(
      new Response(JSON.stringify({ ok: true })),
      { maxBytes: 1024 },
    )).resolves.toEqual({ ok: true });
  });

  it('rejects oversized declared response bodies before reading them', async () => {
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream({ cancel }),
      {
        headers: {
          'content-length': '6',
        },
      },
    );

    await expect(readBoundedJsonResponse(response, {
      maxBytes: 5,
      tooLargeMessage: 'manifest too large',
    })).rejects.toThrow('manifest too large');

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });

  it('cancels streamed response bodies that exceed the byte limit', async () => {
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"ok":true}'));
        },
        cancel,
      }),
    );

    await expect(readBoundedJsonResponse(response, {
      maxBytes: 5,
      tooLargeMessage: 'metadata too large',
    })).rejects.toThrow('metadata too large');

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });

  it('cancels and releases pending body reads when aborted', async () => {
    const controller = new AbortController();
    const reader = {
      read: vi.fn(() => new Promise(() => undefined)),
      cancel: vi.fn(async () => undefined),
      releaseLock: vi.fn(),
    };

    const request = readBoundedJsonResponse({
      headers: new Headers(),
      body: {
        getReader: () => reader,
      },
    }, {
      maxBytes: 1024,
      signal: controller.signal,
    });

    await vi.waitFor(() => expect(reader.read).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(reader.cancel).toHaveBeenCalledTimes(1);
    expect(reader.releaseLock).toHaveBeenCalledTimes(1);
  });
});
