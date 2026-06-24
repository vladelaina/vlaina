import { describe, expect, it, vi } from 'vitest';
import {
  compareVersions,
  fetchUpdateManifest,
  normalizeReleaseAssets,
  normalizeUpdateManifest,
  selectCurrentPlatformAsset,
} from '../../electron/updateManifest.mjs';

describe('electron update manifest helpers', () => {
  it('compares release versions with prerelease and build metadata rules', () => {
    expect(compareVersions('v1.2.3', '1.2.2')).toBe(1);
    expect(compareVersions('1.2.3+build.2', '1.2.3+build.1')).toBe(0);
    expect(compareVersions('1.2.3', '1.2.3-beta.10')).toBe(1);
    expect(compareVersions('1.2.3-beta.10', '1.2.3-beta.2')).toBe(1);
    expect(compareVersions('1.2.3-beta.2', '1.2.3-beta.10')).toBe(-1);
  });

  it('normalizes GitHub releases and chooses the current platform asset', () => {
    expect(normalizeUpdateManifest({
      tag_name: 'v1.2.3',
      html_url: 'https://github.com/vladelaina/vlaina/releases/tag/v1.2.3',
      body: 'Release notes',
      published_at: '2026-06-24T00:00:00.000Z',
      assets: [
        {
          name: 'vlaina-1.2.3-arm64.AppImage',
          browser_download_url: 'https://github.com/vladelaina/vlaina/releases/download/v1.2.3/arm64.AppImage',
        },
        {
          name: 'vlaina-1.2.3-x86_64.AppImage',
          browser_download_url: 'https://github.com/vladelaina/vlaina/releases/download/v1.2.3/x86_64.AppImage',
        },
      ],
    }, {
      defaultDownloadUrl: 'https://github.com/vladelaina/vlaina/releases/latest',
      platform: 'linux',
      arch: 'x64',
    })).toEqual({
      latestVersion: '1.2.3',
      downloadUrl: 'https://github.com/vladelaina/vlaina/releases/download/v1.2.3/x86_64.AppImage',
      releaseUrl: 'https://github.com/vladelaina/vlaina/releases/tag/v1.2.3',
      platformAssetName: 'vlaina-1.2.3-x86_64.AppImage',
      hasPlatformAsset: true,
      releaseNotes: 'Release notes',
      publishedAt: '2026-06-24T00:00:00.000Z',
    });
  });

  it('does not select a known wrong-architecture platform asset', () => {
    const assets = normalizeReleaseAssets([
      {
        name: 'vlaina-1.2.3-arm64.AppImage',
        browser_download_url: 'https://example.com/arm64.AppImage',
      },
    ]);

    expect(selectCurrentPlatformAsset(assets, { platform: 'linux', arch: 'x64' })).toBeNull();
  });

  it('ignores malformed release assets without failing the whole update check', () => {
    expect(normalizeUpdateManifest({
      version: '1.2.3',
      downloadUrl: 'https://example.com/releases/latest',
      assets: [
        { name: 'vlaina-1.2.3-x64.AppImage', browser_download_url: 'file:///tmp/app.AppImage' },
        { name: 'vlaina-1.2.3-x64.AppImage', browser_download_url: 'https://example.com/app.AppImage' },
      ],
    }, {
      defaultDownloadUrl: 'https://example.com/releases/latest',
      platform: 'linux',
      arch: 'x64',
    }).downloadUrl).toBe('https://example.com/app.AppImage');
  });

  it('fetches the manifest with bounded JSON parsing and updater headers', async () => {
    const response = { ok: true, status: 200 };
    const fetchImpl = vi.fn().mockResolvedValue(response);
    const readJsonResponse = vi.fn().mockResolvedValue({
      version: '1.2.3',
      downloadUrl: 'https://example.com/releases/latest',
    });

    await expect(fetchUpdateManifest({
      manifestUrl: 'https://example.com/update.json',
      defaultDownloadUrl: 'https://example.com/releases/latest',
      appVersion: '1.0.0',
      fetchImpl,
      readJsonResponse,
      timeoutMs: 1000,
    })).resolves.toMatchObject({
      latestVersion: '1.2.3',
      downloadUrl: 'https://example.com/releases/latest',
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://example.com/update.json', expect.objectContaining({
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'user-agent': 'vlaina/1.0.0 desktop-updater',
      },
    }));
    expect(readJsonResponse).toHaveBeenCalledWith(response, expect.objectContaining({
      tooLargeMessage: 'Update manifest response body is too large.',
    }));
  });

  it('surfaces HTTP update manifest failures', async () => {
    await expect(fetchUpdateManifest({
      manifestUrl: 'https://example.com/update.json',
      defaultDownloadUrl: 'https://example.com/releases/latest',
      appVersion: '1.0.0',
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 503 }),
      readJsonResponse: vi.fn(),
      timeoutMs: 1000,
    })).rejects.toThrow('Update manifest request failed: HTTP 503');
  });
});
