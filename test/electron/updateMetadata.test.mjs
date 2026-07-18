import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readTrustedDownloadedUpdateMetadata,
  writeTrustedDownloadedUpdateMetadata,
} from '../../electron/updateMetadata.mjs';

let temporaryRoot = '';

function createApp() {
  return {
    getPath(name) {
      if (name !== 'userData') throw new Error(`Unexpected app path: ${name}`);
      return temporaryRoot;
    },
  };
}

function createUpdateInfo(overrides = {}) {
  return {
    latestVersion: '1.2.3',
    platformAssetName: 'vlaina-1.2.3-windows-x64-setup.exe',
    platformAssetSha256: 'd'.repeat(64),
    downloadUrl: 'https://github.com/vladelaina/vlaina/releases/download/v1.2.3/vlaina-1.2.3-windows-x64-setup.exe',
    ...overrides,
  };
}

describe('trusted downloaded update metadata', () => {
  beforeEach(() => {
    temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vlaina-update-metadata-'));
    fs.mkdirSync(path.join(temporaryRoot, 'update-downloads', '1.2.3'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  });

  it('round trips main-process trusted update identity', () => {
    const app = createApp();
    const updateInfo = createUpdateInfo();
    writeTrustedDownloadedUpdateMetadata(app, updateInfo);

    expect(readTrustedDownloadedUpdateMetadata(app, updateInfo)).toEqual({
      latestVersion: '1.2.3',
      platformAssetName: 'vlaina-1.2.3-windows-x64-setup.exe',
      platformAssetSha256: 'd'.repeat(64),
      downloadUrl: updateInfo.downloadUrl,
      hasPlatformAsset: true,
    });
  });

  it('does not let a renderer select metadata for a different asset', () => {
    const app = createApp();
    writeTrustedDownloadedUpdateMetadata(app, createUpdateInfo());

    expect(() => readTrustedDownloadedUpdateMetadata(app, createUpdateInfo({
      platformAssetName: 'vlaina-1.2.3-windows-arm64-setup.exe',
    }))).toThrow();
  });
});
