import { defineConfig } from '@playwright/test';

const e2ePort = Number.parseInt(process.env.VLAINA_E2E_PORT ?? '3100', 10);
const e2eBaseUrl = `http://127.0.0.1:${Number.isFinite(e2ePort) ? e2ePort : 3100}`;

process.env.NO_PROXY = ['127.0.0.1', 'localhost', process.env.NO_PROXY]
  .filter(Boolean)
  .join(',');
process.env.no_proxy = ['127.0.0.1', 'localhost', process.env.no_proxy]
  .filter(Boolean)
  .join(',');

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${Number.isFinite(e2ePort) ? e2ePort : 3100}`,
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
