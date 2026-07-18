import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerDesktopUpdateIpc } from '../../electron/desktopUpdateIpc.mjs';

const originalDistributionChannel = process.env.APP_DISTRIBUTION_CHANNEL;
const digest = `sha256:${'c'.repeat(64)}`;

function currentPlatformAssetName(version) {
  if (process.platform === 'win32') {
    return `vlaina-${version}-windows-${process.arch}-setup.exe`;
  }
  if (process.platform === 'darwin') {
    return `vlaina-${version}-mac-${process.arch}.dmg`;
  }
  const arch = process.arch === 'x64' ? 'x86_64' : process.arch;
  return `vlaina-${version}-linux-${arch}.AppImage`;
}

function createManifestResponse() {
  const version = '1.1.0';
  const name = currentPlatformAssetName(version);
  return new Response(JSON.stringify({
    tag_name: `v${version}`,
    html_url: `https://github.com/vladelaina/vlaina/releases/tag/v${version}`,
    assets: [{
      name,
      browser_download_url: `https://github.com/vladelaina/vlaina/releases/download/v${version}/${name}`,
      digest,
    }],
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function createHarness({
  fetchImpl = vi.fn(async () => createManifestResponse()),
  readTrustedDownloadedUpdateMetadataImpl = vi.fn(() => {
    throw new Error('No trusted downloaded update metadata.');
  }),
} = {}) {
  delete process.env.APP_DISTRIBUTION_CHANNEL;
  const handlers = new Map();
  const downloadUpdateAssetImpl = vi.fn().mockResolvedValue({
    filePath: '/updates/vlaina-installer',
    fileName: 'vlaina-installer',
    downloadedAt: '2026-07-18T00:00:00.000Z',
    sizeBytes: 10,
  });
  const normalizeDownloadedUpdateForOpenImpl = vi.fn().mockResolvedValue('/updates/vlaina-installer');
  const writeTrustedDownloadedUpdateMetadataImpl = vi.fn();
  const shell = { openPath: vi.fn().mockResolvedValue('') };

  registerDesktopUpdateIpc({
    app: {
      getVersion: () => '1.0.0',
      isPackaged: true,
    },
    deleteDownloadedUpdateImpl: vi.fn(),
    downloadUpdateAssetImpl,
    fetchImpl,
    handleIpc: (channel, handler) => handlers.set(channel, handler),
    normalizeDownloadedUpdateForOpenImpl,
    readTrustedDownloadedUpdateMetadataImpl,
    shell,
    writeTrustedDownloadedUpdateMetadataImpl,
  });

  return {
    downloadUpdateAssetImpl,
    fetchImpl,
    handlers,
    normalizeDownloadedUpdateForOpenImpl,
    readTrustedDownloadedUpdateMetadataImpl,
    shell,
    writeTrustedDownloadedUpdateMetadataImpl,
  };
}

afterEach(() => {
  if (originalDistributionChannel === undefined) {
    delete process.env.APP_DISTRIBUTION_CHANNEL;
  } else {
    process.env.APP_DISTRIBUTION_CHANNEL = originalDistributionChannel;
  }
});

describe('desktop update IPC trust binding', () => {
  it('downloads with main-process manifest data instead of renderer-owned fields', async () => {
    const harness = createHarness();
    const updateInfo = await harness.handlers.get('desktop:update:check')();

    await harness.handlers.get('desktop:update:download')(null, {
      ...updateInfo,
      releaseNotes: 'renderer replacement',
      downloadedFilePath: '/tmp/renderer-controlled',
    });

    expect(harness.downloadUpdateAssetImpl).toHaveBeenCalledWith(expect.objectContaining({
      updateInfo: expect.objectContaining({
        downloadUrl: updateInfo.downloadUrl,
        platformAssetSha256: 'c'.repeat(64),
        releaseNotes: '',
      }),
    }));
    expect(harness.downloadUpdateAssetImpl.mock.calls[0][0].updateInfo.downloadedFilePath).toBeUndefined();
    expect(harness.writeTrustedDownloadedUpdateMetadataImpl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ platformAssetSha256: 'c'.repeat(64) }),
    );
  });

  it('rejects renderer update metadata that does not match the trusted manifest', async () => {
    const harness = createHarness();
    const updateInfo = await harness.handlers.get('desktop:update:check')();

    await expect(harness.handlers.get('desktop:update:download')(null, {
      ...updateInfo,
      downloadUrl: 'https://downloads.example.test/vlaina-malicious.exe',
    })).rejects.toThrow('does not match the trusted update manifest');

    expect(harness.downloadUpdateAssetImpl).not.toHaveBeenCalled();
  });

  it('opens only the installer derived from trusted manifest data', async () => {
    const harness = createHarness();
    const updateInfo = await harness.handlers.get('desktop:update:check')();

    await harness.handlers.get('desktop:update:open-downloaded')(null, {
      ...updateInfo,
      downloadedFilePath: '/tmp/renderer-controlled',
    });

    expect(harness.normalizeDownloadedUpdateForOpenImpl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.not.objectContaining({ downloadedFilePath: '/tmp/renderer-controlled' }),
    );
    expect(harness.shell.openPath).toHaveBeenCalledWith('/updates/vlaina-installer');
  });

  it('can open a previously verified installer while the manifest service is offline', async () => {
    const version = '1.1.0';
    const platformAssetName = currentPlatformAssetName(version);
    const trustedMetadata = {
      latestVersion: version,
      platformAssetName,
      platformAssetSha256: 'c'.repeat(64),
      downloadUrl: `https://github.com/vladelaina/vlaina/releases/download/v${version}/${platformAssetName}`,
      hasPlatformAsset: true,
    };
    const readTrustedDownloadedUpdateMetadataImpl = vi.fn(() => trustedMetadata);
    const harness = createHarness({
      fetchImpl: vi.fn().mockRejectedValue(new Error('offline')),
      readTrustedDownloadedUpdateMetadataImpl,
    });

    await harness.handlers.get('desktop:update:open-downloaded')(null, trustedMetadata);

    expect(readTrustedDownloadedUpdateMetadataImpl).toHaveBeenCalled();
    expect(harness.normalizeDownloadedUpdateForOpenImpl).toHaveBeenCalledWith(
      expect.any(Object),
      trustedMetadata,
    );
    expect(harness.shell.openPath).toHaveBeenCalledWith('/updates/vlaina-installer');
  });
});
