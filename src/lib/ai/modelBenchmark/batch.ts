import type { AIModel, Provider } from '../types';
import {
  DEFAULT_BENCHMARK_BATCH_DELAY_MS,
  DEFAULT_BENCHMARK_CONCURRENCY,
} from './constants';
import { checkModelHealth } from './singleModel';
import type { BenchmarkModelsOptions, BenchmarkResultMap, HealthCheckResult } from './types';

function normalizeConcurrency(value?: number): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_BENCHMARK_CONCURRENCY;
  }

  const rounded = Math.floor(value);
  return Math.min(Math.max(rounded, 1), 10);
}

function normalizeBatchDelay(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_BENCHMARK_BATCH_DELAY_MS;
  }
  return Math.max(0, Math.floor(value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function benchmarkModels(
  provider: Provider,
  models: AIModel[],
  options: BenchmarkModelsOptions = {}
): Promise<BenchmarkResultMap> {
  const resultMap: BenchmarkResultMap = {};
  const total = models.length;

  if (total === 0) {
    return resultMap;
  }

  const concurrency = normalizeConcurrency(options.concurrency);
  const batchDelayMs = normalizeBatchDelay(options.batchDelayMs);
  let completed = 0;

  for (let index = 0; index < models.length; index += concurrency) {
    const currentBatch = models.slice(index, index + concurrency);
    await Promise.all(
      currentBatch.map(async (model) => {
        let result: HealthCheckResult;
        try {
          result = await checkModelHealth(provider, model, {
            timeoutMs: options.timeoutMs,
          });
        } catch (error: unknown) {
          result = {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            endpoint: 'chat',
          };
        }

        resultMap[model.id] = result;
        completed += 1;
        options.onProgress?.({
          modelId: model.id,
          result,
          completed,
          total,
        });
      })
    );

    const hasMore = index + concurrency < models.length;
    if (hasMore && batchDelayMs > 0) {
      await sleep(batchDelayMs);
    }
  }

  return resultMap;
}
