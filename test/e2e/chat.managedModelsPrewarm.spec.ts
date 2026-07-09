import { expect, test, type Page } from '@playwright/test';
import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  setAppViewMode,
} from './notesE2E';

type FakeModelsApiState = {
  modelsRequestCount: number;
  versionRequestCount: number;
};

function sendJson(response: ServerResponse, status: number, payload: Record<string, unknown>): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function startFakeModelsApi(): Promise<{
  baseUrl: string;
  state: FakeModelsApiState;
  close: () => Promise<void>;
}> {
  const state: FakeModelsApiState = {
    modelsRequestCount: 0,
    versionRequestCount: 0,
  };

  const server = createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');

      if (request.method === 'GET' && requestUrl.pathname === '/v1/models') {
        state.modelsRequestCount += 1;
        sendJson(response, 200, {
          object: 'list',
          model_catalog_version: 'e2e-managed-models-v1',
          data: [
            {
              id: 'gpt-4o-mini-e2e',
              object: 'model',
              created: 1,
              owned_by: 'vlaina',
              display_name: 'GPT-4o Mini E2E',
              group: 'OpenAI',
              price_tier: '$',
              price_score: 0.1,
              is_default: true,
            },
          ],
        });
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/v1/models/version') {
        state.versionRequestCount += 1;
        sendJson(response, 200, {
          success: true,
          model_catalog_version: 'e2e-managed-models-v1',
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

async function getManagedModels(page: Page): Promise<Array<{ id: string; name: string; group?: string }>> {
  return page.evaluate(() => {
    const data = (window as any).__vlainaE2E.getUnifiedData();
    return (data.ai.models as Array<{ id: string; name: string; group?: string; providerId: string }>)
      .filter((model) => model.providerId === 'vlaina-managed')
      .map((model) => ({
        id: model.id,
        name: model.name,
        group: model.group,
      }));
  });
}

test.describe('managed model catalog prewarm', () => {
  test.setTimeout(90_000);

  test('loads managed models during notes startup prewarm and reuses the catalog when opening the selector', async () => {
    const fakeApi = await startFakeModelsApi();
    const { app, userDataRoot } = await launchIsolatedElectron('chat-managed-models-prewarm', {
      APP_API_BASE_URL: fakeApi.baseUrl,
    });

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      await expect.poll(() => fakeApi.state.modelsRequestCount, { timeout: 15_000 }).toBe(1);
      await expect.poll(() => getManagedModels(page), { timeout: 10_000 }).toEqual([
        {
          id: 'vlaina-managed::gpt-4o-mini-e2e',
          name: 'GPT-4o Mini E2E',
          group: 'OpenAI',
        },
      ]);

      await setAppViewMode(page, 'chat');
      await page.getByRole('button', { name: /GPT-4o Mini E2E/ }).click();
      await expect(page.locator('[data-model-selector-dropdown="true"]')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: 'OpenAI' })).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('[data-model-id="vlaina-managed::gpt-4o-mini-e2e"]')).toContainText('GPT-4o Mini E2E');

      await expect.poll(() => fakeApi.state.versionRequestCount, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
      expect(fakeApi.state.modelsRequestCount).toBe(1);
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
      await fakeApi.close();
    }
  });
});
