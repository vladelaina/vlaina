import { expect, test, type Page } from '@playwright/test';
import * as http from 'node:http';
import type { IncomingMessage } from 'node:http';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

const SETTINGS_MODAL_SELECTOR = '[data-settings-modal="true"]';
const CURRENT_VERSION = '0.1.16';
const LATEST_VERSION = '0.1.17';
const LATEST_RELEASE_TAG = `v${LATEST_VERSION}`;
const LATEST_RELEASE_BASE_URL = `https://github.com/vladelaina/vlaina/releases/download/${LATEST_RELEASE_TAG}`;
const UPDATE_ASSETS = [
  {
    name: `vlaina-${LATEST_VERSION}-windows-x64-setup.exe`,
    browser_download_url: `${LATEST_RELEASE_BASE_URL}/vlaina-${LATEST_VERSION}-windows-x64-setup.exe`,
  },
  {
    name: `vlaina-${LATEST_VERSION}-windows-arm64-setup.exe`,
    browser_download_url: `${LATEST_RELEASE_BASE_URL}/vlaina-${LATEST_VERSION}-windows-arm64-setup.exe`,
  },
  {
    name: `vlaina-${LATEST_VERSION}-mac-x64.dmg`,
    browser_download_url: `${LATEST_RELEASE_BASE_URL}/vlaina-${LATEST_VERSION}-mac-x64.dmg`,
  },
  {
    name: `vlaina-${LATEST_VERSION}-mac-arm64.dmg`,
    browser_download_url: `${LATEST_RELEASE_BASE_URL}/vlaina-${LATEST_VERSION}-mac-arm64.dmg`,
  },
  {
    name: `vlaina-${LATEST_VERSION}-linux-x86_64.AppImage`,
    browser_download_url: `${LATEST_RELEASE_BASE_URL}/vlaina-${LATEST_VERSION}-linux-x86_64.AppImage`,
  },
  {
    name: `vlaina-${LATEST_VERSION}-linux-arm64.AppImage`,
    browser_download_url: `${LATEST_RELEASE_BASE_URL}/vlaina-${LATEST_VERSION}-linux-arm64.AppImage`,
  },
];

function getExpectedCurrentPlatformAsset() {
  if (process.platform === 'win32' && process.arch === 'x64') return UPDATE_ASSETS[0];
  if (process.platform === 'win32' && process.arch === 'arm64') return UPDATE_ASSETS[1];
  if (process.platform === 'darwin' && process.arch === 'x64') return UPDATE_ASSETS[2];
  if (process.platform === 'darwin' && process.arch === 'arm64') return UPDATE_ASSETS[3];
  if (process.platform === 'linux' && process.arch === 'x64') return UPDATE_ASSETS[4];
  if (process.platform === 'linux' && process.arch === 'arm64') return UPDATE_ASSETS[5];
  throw new Error(`No update asset fixture for ${process.platform}/${process.arch}.`);
}

async function openAboutSettings(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'about' } }));
  });
  await expect(page.locator(SETTINGS_MODAL_SELECTOR)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(SETTINGS_MODAL_SELECTOR)).toHaveAttribute('data-settings-active-tab', 'about', {
    timeout: 10_000,
  });
  await expect(page.locator('[data-settings-tab-panel="about"]')).toBeVisible({ timeout: 10_000 });
}

async function startUpdateManifestServer() {
  const requests: Array<{ url: string; userAgent: string }> = [];
  const server = http.createServer((request: IncomingMessage, response) => {
    requests.push({
      url: request.url ?? '',
      userAgent: String(request.headers['user-agent'] ?? ''),
    });

    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify({
      version: LATEST_VERSION,
      downloadUrl: `https://github.com/vladelaina/vlaina/releases/tag/${LATEST_RELEASE_TAG}`,
      assets: UPDATE_ASSETS,
      releaseNotes: 'E2E update check release',
      publishedAt: '2026-06-26T00:00:00.000Z',
    }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to bind update manifest server.');
  }

  return {
    url: `http://127.0.0.1:${address.port}/latest`,
    requests,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    }),
  };
}

test.describe('settings update checks', () => {
  test.setTimeout(90_000);

  test('reports an available desktop update when the app version is behind', async () => {
    const expectedAsset = getExpectedCurrentPlatformAsset();
    const manifestServer = await startUpdateManifestServer();
    const { app, userDataRoot } = await launchIsolatedElectron('settings-update-check', {
      envOverrides: {
        APP_UPDATE_MANIFEST_URL: manifestServer.url,
      },
    });

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await openAboutSettings(page);
      await expect(page.locator('[data-settings-tab-panel="about"]')).toContainText(CURRENT_VERSION);

      await page.getByRole('button', { name: 'Check' }).click();

      await expect(page.locator('[data-settings-tab-panel="about"]')).toContainText(`v${LATEST_VERSION} available`, {
        timeout: 15_000,
      });
      await expect(page.getByRole('button', { name: 'Update' })).toHaveAttribute('title', expectedAsset.name);
      expect(manifestServer.requests).toEqual([
        {
          url: '/latest',
          userAgent: `vlaina/${CURRENT_VERSION} desktop-updater`,
        },
      ]);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
      await manifestServer.close();
    }
  });
});
