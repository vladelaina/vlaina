export type BenchmarkEndpoint = 'chat' | 'embeddings' | 'image' | 'responses';

export interface HealthCheckResult {
  status: 'success' | 'error';
  latency?: number;
  error?: string;
  endpoint: BenchmarkEndpoint;
}

export interface ModelBenchmarkProgress {
  modelId: string;
  result: HealthCheckResult;
  completed: number;
  total: number;
}

export interface CheckModelHealthOptions {
  timeoutMs?: number;
}

export interface BenchmarkModelsOptions extends CheckModelHealthOptions {
  concurrency?: number;
  batchDelayMs?: number;
  onProgress?: (progress: ModelBenchmarkProgress) => void;
}

export type BenchmarkResultMap = Record<string, HealthCheckResult>;
