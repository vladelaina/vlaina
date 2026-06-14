import { describe, expect, it, vi } from 'vitest';
import { MAX_SETTINGS_API_JSON_RESPONSE_BODY_BYTES, readSettingsApiJson } from './settingsApiJson';

describe('readSettingsApiJson', () => {
  it('parses small JSON responses', async () => {
    await expect(readSettingsApiJson<{ success: boolean }>(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    )).resolves.toEqual({ success: true });
  });

  it('rejects oversized settings JSON responses before reading the body', async () => {
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream({
        cancel,
      }),
      {
        status: 200,
        headers: {
          'content-length': String(MAX_SETTINGS_API_JSON_RESPONSE_BODY_BYTES + 1),
        },
      }
    );

    await expect(readSettingsApiJson(response)).rejects.toThrow('Settings API response body is too large.');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });

  it('ignores invalid settings content-length syntax', async () => {
    const response = new Response(JSON.stringify({ success: true }), {
      headers: {
        'content-length': '1e12',
      },
    });

    await expect(readSettingsApiJson(response)).resolves.toEqual({ success: true });
  });

  it('cancels settings JSON body reads when the streamed body exceeds the limit', async () => {
    const reader = {
      read: vi.fn(async () => ({
        done: false,
        value: { byteLength: MAX_SETTINGS_API_JSON_RESPONSE_BODY_BYTES + 1 } as Uint8Array,
      })),
      cancel: vi.fn(async () => undefined),
      releaseLock: vi.fn(),
    };
    const response = {
      headers: new Headers(),
      body: {
        getReader: () => reader,
      },
    } as unknown as Response;

    await expect(readSettingsApiJson(response)).rejects.toThrow('Settings API response body is too large.');
    expect(reader.cancel).toHaveBeenCalledTimes(1);
    expect(reader.releaseLock).toHaveBeenCalledTimes(1);
  });
});
