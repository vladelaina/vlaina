import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_SETTINGS_API_JSON_RESPONSE_BODY_BYTES } from './settingsApiJson';

describe('loadCommunitySettings', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('normalizes community settings from the site settings API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      settings: {
        community: {
          qqGroupNumber: ' 123456 ',
          qqQrCodeText: ' qq-code ',
          wechatQrCodeText: ' wechat-code ',
        },
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { loadCommunitySettings } = await import('./aboutCommunitySettings');

    await expect(loadCommunitySettings()).resolves.toEqual({
      qqGroupNumber: '123456',
      qqQrCodeText: 'qq-code',
      wechatQrCodeText: 'wechat-code',
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.vlaina.com/site-settings', { cache: 'no-store' });
  });

  it('falls back to empty community settings when the settings JSON body is oversized', async () => {
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('x'.repeat(MAX_SETTINGS_API_JSON_RESPONSE_BODY_BYTES + 1)));
        },
        cancel,
      }),
      { status: 200 }
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const { emptyCommunitySettings, loadCommunitySettings } = await import('./aboutCommunitySettings');

    await expect(loadCommunitySettings()).resolves.toEqual(emptyCommunitySettings);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });
});
