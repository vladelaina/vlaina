import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
} from './notesE2E';

type FakeAuthApiState = {
  callbackUrl: string | null;
  openedAuthState: string;
  resultToken: string;
  desktopStartCount: number;
  desktopResultCount: number;
  sessionRequestCount: number;
  sessionResponseCount: number;
  sessionRequestStartedAt: number | null;
  sessionResponseSentAt: number | null;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  let body = '';
  for await (const chunk of request) {
    body += String(chunk);
  }
  return body ? JSON.parse(body) as Record<string, unknown> : {};
}

function sendJson(response: ServerResponse, status: number, payload: Record<string, unknown>): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function startFakeAuthApi(options: { sessionDelayMs: number }): Promise<{
  baseUrl: string;
  state: FakeAuthApiState;
  close: () => Promise<void>;
}> {
  const state: FakeAuthApiState = {
    callbackUrl: null,
    openedAuthState: 'desktop-state-e2e',
    resultToken: 'desktop-result-token-e2e',
    desktopStartCount: 0,
    desktopResultCount: 0,
    sessionRequestCount: 0,
    sessionResponseCount: 0,
    sessionRequestStartedAt: null,
    sessionResponseSentAt: null,
  };

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');

      if (request.method === 'POST' && requestUrl.pathname === '/auth/google/desktop/start') {
        const body = await readJsonBody(request);
        state.desktopStartCount += 1;
        state.callbackUrl = typeof body.callbackUrl === 'string' ? body.callbackUrl : null;
        sendJson(response, 200, {
          success: true,
          state: state.openedAuthState,
          authUrl: `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(state.openedAuthState)}`,
          expiresInSeconds: 300,
        });
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/auth/google/desktop/result') {
        state.desktopResultCount += 1;
        sendJson(response, 200, {
          success: true,
          provider: 'google',
          username: 'E2E Google User',
          primaryEmail: 'e2e-google@example.com',
          avatarUrl: 'https://example.com/e2e-google-avatar.png',
          sessionToken: 'nts_e2e_google_session',
        });
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/auth/session') {
        state.sessionRequestCount += 1;
        state.sessionRequestStartedAt = Date.now();
        await delay(options.sessionDelayMs);
        state.sessionResponseSentAt = Date.now();
        state.sessionResponseCount += 1;
        sendJson(response, 200, {
          connected: true,
          provider: 'google',
          username: 'E2E Google User',
          primaryEmail: 'e2e-google@example.com',
          avatarUrl: 'https://example.com/e2e-google-avatar.png',
          membershipTier: 'free',
          membershipName: 'Free',
        });
        return;
      }

      sendJson(response, 404, { success: false, error: 'Not found' });
    } catch (error) {
      sendJson(response, 500, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function interceptExternalAuthUrls(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ shell }) => {
    const globalState = globalThis as typeof globalThis & {
      __vlainaE2EOpenedExternalUrls?: string[];
    };
    globalState.__vlainaE2EOpenedExternalUrls = [];
    shell.openExternal = async (url: string) => {
      globalState.__vlainaE2EOpenedExternalUrls?.push(url);
      return true;
    };
  });
}

async function getOpenedExternalUrls(app: ElectronApplication): Promise<string[]> {
  return await app.evaluate(() => {
    const globalState = globalThis as typeof globalThis & {
      __vlainaE2EOpenedExternalUrls?: string[];
    };
    return globalState.__vlainaE2EOpenedExternalUrls ?? [];
  });
}

async function openAccountLoginDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'vlaina' }).click();
  await page.getByRole('button', { name: /Sign In|登录|登入/i }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /Google/i })).toBeVisible({ timeout: 10_000 });
}

test.describe('desktop Google account sign-in', () => {
  test.setTimeout(90_000);

  test('shows the signed-in account before the post-auth session refresh completes', async () => {
    const fakeApi = await startFakeAuthApi({ sessionDelayMs: 2500 });
    const { app, userDataRoot } = await launchIsolatedElectron('account-google-auth', {
      APP_API_BASE_URL: fakeApi.baseUrl,
    });

    try {
      await app.firstWindow();
      await interceptExternalAuthUrls(app);
      const [page] = await getOpenBridgePages(app, 1);

      await openAccountLoginDialog(page);
      const googleButton = page.getByRole('dialog').getByRole('button', { name: /Google/i });
      await googleButton.click();

      await expect.poll(async () => fakeApi.state.callbackUrl, { timeout: 10_000 }).not.toBeNull();
      await expect.poll(() => getOpenedExternalUrls(app), { timeout: 10_000 }).toHaveLength(1);
      await expect.poll(() => getOpenedExternalUrls(app), { timeout: 10_000 }).toEqual([
        `https://accounts.google.com/o/oauth2/v2/auth?state=${fakeApi.state.openedAuthState}`,
      ]);

      const callbackUrl = new URL(fakeApi.state.callbackUrl!);
      callbackUrl.searchParams.set('state', fakeApi.state.openedAuthState);
      callbackUrl.searchParams.set('result_token', fakeApi.state.resultToken);
      const callbackStartedAt = Date.now();
      const callbackResponse = await fetch(callbackUrl);
      expect(callbackResponse.status).toBe(200);

      await expect(page.getByRole('dialog').getByRole('button', { name: /Google/i })).toBeHidden({ timeout: 10_000 });
      const visibleSignedInMs = Date.now() - callbackStartedAt;
      expect(fakeApi.state.sessionResponseSentAt).toBeNull();
      await expect(page.getByRole('img', { name: 'E2E Google User' })).toBeVisible({ timeout: 10_000 });

      await expect.poll(() => fakeApi.state.sessionRequestCount, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
      await expect.poll(() => fakeApi.state.sessionResponseCount, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
      console.info('[account-google-auth-timing]', {
        visibleSignedInMs,
        sessionDelayMs: 2500,
        desktopStartCount: fakeApi.state.desktopStartCount,
        desktopResultCount: fakeApi.state.desktopResultCount,
        sessionRequestStartedAt: fakeApi.state.sessionRequestStartedAt,
        sessionResponseSentAt: fakeApi.state.sessionResponseSentAt,
      });
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
      await fakeApi.close();
    }
  });
});
