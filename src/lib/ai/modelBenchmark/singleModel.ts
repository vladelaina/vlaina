import { parseAPIError, parseHTTPError } from '../errors';
import { normalizeApiHost } from '../utils';
import type { AIModel, Provider } from '../types';
import { DEFAULT_BENCHMARK_TIMEOUT_MS } from './constants';
import { inferBenchmarkEndpoint } from './endpoint';
import type { BenchmarkEndpoint, CheckModelHealthOptions, HealthCheckResult } from './types';

function buildBenchmarkUrl(provider: Provider, endpoint: BenchmarkEndpoint): string {
  const host = normalizeApiHost(provider.apiHost);
  const baseUrl = host.endsWith('/v1') ? host : `${host}/v1`;

  if (endpoint === 'embeddings') {
    return `${baseUrl}/embeddings`;
  }

  if (endpoint === 'image') {
    return `${baseUrl}/images/generations`;
  }

  if (endpoint === 'responses') {
    return `${baseUrl}/responses`;
  }

  return `${baseUrl}/chat/completions`;
}

function buildBenchmarkBody(modelId: string, endpoint: BenchmarkEndpoint): Record<string, unknown> {
  if (endpoint === 'embeddings') {
    return {
      model: modelId,
      input: 'hello world',
    };
  }

  if (endpoint === 'image') {
    return {
      model: modelId,
      prompt: 'a cute cat',
      n: 1,
      size: '1024x1024',
    };
  }

  if (endpoint === 'responses') {
    return {
      model: modelId,
      input: 'hi',
      max_output_tokens: 16,
    };
  }

  const chatBody: Record<string, unknown> = {
    model: modelId,
    messages: [{ role: 'user', content: 'hi' }],
    stream: false,
  };

  if (/^o\d/i.test(modelId)) {
    chatBody.max_completion_tokens = 16;
  } else {
    chatBody.max_tokens = 16;
  }

  return chatBody;
}

function readErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const body = payload as Record<string, unknown>;
  const topLevelError = body.error;
  if (!topLevelError) {
    return undefined;
  }

  if (typeof topLevelError === 'string') {
    return topLevelError;
  }

  if (typeof topLevelError === 'object' && topLevelError !== null) {
    const nested = topLevelError as Record<string, unknown>;
    if (typeof nested.message === 'string') {
      return nested.message;
    }
    if (typeof nested.error === 'string') {
      return nested.error;
    }
    if (typeof nested.error === 'object' && nested.error !== null) {
      const deepNested = nested.error as Record<string, unknown>;
      if (typeof deepNested.message === 'string') {
        return deepNested.message;
      }
    }
  }

  return undefined;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function checkModelHealth(
  provider: Provider,
  model: AIModel,
  options: CheckModelHealthOptions = {}
): Promise<HealthCheckResult> {
  const endpoint = inferBenchmarkEndpoint(model.id);
  const requestedTimeoutMs = options.timeoutMs ?? DEFAULT_BENCHMARK_TIMEOUT_MS;
  const timeoutMs = Number.isFinite(requestedTimeoutMs)
    ? Math.max(0, Math.floor(requestedTimeoutMs))
    : DEFAULT_BENCHMARK_TIMEOUT_MS;
  const start = performance.now();
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    const response = await fetch(buildBenchmarkUrl(provider, endpoint), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildBenchmarkBody(model.id, endpoint)),
      signal: timeoutMs > 0 ? controller.signal : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      let errorBody: unknown;
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        errorBody = { message: errorText };
      }
      throw parseHTTPError(response.status, errorBody);
    }

    const payload = await parseResponsePayload(response);
    const upstreamErrorMessage = readErrorMessage(payload);
    if (upstreamErrorMessage) {
      throw new Error(upstreamErrorMessage);
    }

    return {
      status: 'success',
      latency: Math.round(performance.now() - start),
      endpoint,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        status: 'error',
        error: timeoutMs > 0
          ? `Request timed out (${Math.round(timeoutMs / 1000)}s)`
          : 'Request aborted',
        endpoint,
      };
    }

    const parsedError = parseAPIError(error);
    return {
      status: 'error',
      error: parsedError.message || 'Unknown error',
      endpoint,
    };
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
