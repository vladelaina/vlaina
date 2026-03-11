import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIModel, Provider } from '../types';
import { backgroundBenchmarkRunner } from './backgroundRunner';
import { benchmarkModels } from './batch';

vi.mock('./batch', () => ({
  benchmarkModels: vi.fn(),
}));

const provider: Provider = {
  id: 'provider-1',
  name: 'Provider',
  type: 'newapi',
  apiHost: 'https://api.example.com',
  apiKey: 'sk-test',
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
};

function createModel(id: string): AIModel {
  return {
    id,
    apiModelId: id,
    name: id,
    providerId: provider.id,
    enabled: true,
    createdAt: 1,
  };
}

beforeEach(() => {
  backgroundBenchmarkRunner.clear(provider.id);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('backgroundBenchmarkRunner', () => {
  it('keeps benchmark running independent of UI subscriptions', async () => {
    const mockedBenchmarkModels = vi.mocked(benchmarkModels);
    mockedBenchmarkModels.mockImplementation(async (_provider, models, options) => {
      options?.onProgress?.({
        modelId: models[0].id,
        completed: 1,
        total: models.length,
        result: { status: 'success', latency: 10, endpoint: 'chat' },
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      options?.onProgress?.({
        modelId: models[1].id,
        completed: 2,
        total: models.length,
        result: { status: 'success', latency: 12, endpoint: 'chat' },
      });
      return {
        [models[0].id]: { status: 'success', latency: 10, endpoint: 'chat' },
        [models[1].id]: { status: 'success', latency: 12, endpoint: 'chat' },
      };
    });

    const models = [createModel('m-1'), createModel('m-2')];
    const snapshots: Array<{ completed: number; running: boolean }> = [];
    const unsubscribe = backgroundBenchmarkRunner.subscribe(provider.id, (snapshot) => {
      snapshots.push({ completed: snapshot.completed, running: snapshot.isRunning });
    });

    const started = backgroundBenchmarkRunner.start(provider, models);
    expect(started).toBe(true);

    const runningSnapshot = backgroundBenchmarkRunner.getSnapshot(provider.id);
    expect(runningSnapshot?.isRunning).toBe(true);

    unsubscribe();

    await new Promise((resolve) => setTimeout(resolve, 30));

    const finalSnapshot = backgroundBenchmarkRunner.getSnapshot(provider.id);
    expect(finalSnapshot?.isRunning).toBe(false);
    expect(finalSnapshot?.overall).toBe('success');
    expect(finalSnapshot?.completed).toBe(2);
    expect(finalSnapshot?.items['m-1']?.status).toBe('success');
    expect(finalSnapshot?.items['m-2']?.status).toBe('success');
    expect(snapshots.length).toBeGreaterThan(0);
  });
});
