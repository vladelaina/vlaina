import { parseAPIError, parseHTTPError } from '../errors';
import { parseErrorTag } from '../errorTag';
import { buildAnthropicBaseUrl, buildOpenAIBaseUrl, resolveApiModelId } from '../utils';
import { providerFetch } from '../providerHttp';
import type { AIModel, Provider } from '../types';
import { DEFAULT_BENCHMARK_TIMEOUT_MS } from './constants';
import { inferBenchmarkEndpoint } from './endpoint';
import type { BenchmarkEndpoint, CheckModelHealthOptions, HealthCheckResult } from './types';

function buildBenchmarkUrl(provider: Provider, endpoint: BenchmarkEndpoint): string {
  if (provider.endpointType === 'anthropic') {
    return `${buildAnthropicBaseUrl(provider.apiHost)}/messages`;
  }

  const baseUrl = buildOpenAIBaseUrl(provider.apiHost);

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

function buildBenchmarkBody(
  modelId: string,
  endpoint: BenchmarkEndpoint,
  endpointType?: Provider['endpointType']
): Record<string, unknown> {
  if (endpoint === 'chat') {
    const chatBody: Record<string, unknown> = {
      model: modelId,
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    };

    if (endpointType === 'anthropic' || !/^o\d/i.test(modelId)) {
      chatBody.max_tokens = 16;
    } else {
      chatBody.max_completion_tokens = 16;
    }

    return chatBody;
  }

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

  return {};
}

function readErrorMessage(payload: unknown): string | undefined {
  if (typeof payload === 'string') {
    return readEmbeddedErrorMessage(payload) || payload.trim() || undefined;
  }

  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const body = payload as Record<string, unknown>;
  const topLevelError = body.error;
  if (topLevelError) {
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
  }

  const nestedContentError = readContentPayloadError(body);
  if (nestedContentError) {
    return nestedContentError;
  }

  const fallbackMessage =
    readStringField(body, 'message') ||
    readStringField(body, 'msg') ||
    readStringField(body, 'detail') ||
    readStringField(body, 'error_description');
  if (fallbackMessage) {
    return fallbackMessage;
  }

  return undefined;
}

function readStringField(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readEmbeddedErrorMessage(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsedError = parseErrorTag(trimmed);
  if (parsedError) {
    return parsedError.content || 'Unknown error';
  }

  return undefined;
}

function readContentPayloadError(payload: Record<string, unknown>): string | undefined {
  const choiceContent = readChoiceContentError(payload);
  if (choiceContent) {
    return choiceContent;
  }

  const responseContent = readResponsesContentError(payload);
  if (responseContent) {
    return responseContent;
  }

  return undefined;
}

function readChoiceContentError(payload: Record<string, unknown>): string | undefined {
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return undefined;
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== 'object') {
    return undefined;
  }

  const message = (firstChoice as Record<string, unknown>).message;
  if (!message || typeof message !== 'object') {
    return undefined;
  }

  const content = (message as Record<string, unknown>).content;
  if (typeof content === 'string') {
    return readEmbeddedErrorMessage(content);
  }

  if (Array.isArray(content)) {
    for (const item of content) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const text = (item as Record<string, unknown>).text;
      if (typeof text === 'string') {
        const embeddedError = readEmbeddedErrorMessage(text);
        if (embeddedError) {
          return embeddedError;
        }
      }
    }
  }

  return undefined;
}

function readResponsesContentError(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.output_text === 'string') {
    return readEmbeddedErrorMessage(payload.output_text);
  }

  const output = payload.output;
  if (!Array.isArray(output)) {
    return undefined;
  }

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!part || typeof part !== 'object') {
        continue;
      }

      const text = (part as Record<string, unknown>).text;
      if (typeof text === 'string') {
        const embeddedError = readEmbeddedErrorMessage(text);
        if (embeddedError) {
          return embeddedError;
        }
      }
    }
  }

  return undefined;
}

function isExpectedSuccessPayload(payload: unknown, endpoint: BenchmarkEndpoint): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const body = payload as Record<string, unknown>;

  if (endpoint === 'embeddings' || endpoint === 'image') {
    return Array.isArray(body.data) && body.data.length > 0;
  }

  if (endpoint === 'responses') {
    return Array.isArray(body.output) || typeof body.output_text === 'string';
  }

  return (
    (Array.isArray(body.choices) && body.choices.length > 0) ||
    (Array.isArray(body.content) && body.content.length > 0)
  );
}

function buildBenchmarkHeaders(provider: Provider): Record<string, string> {
  if (provider.endpointType === 'anthropic') {
    return {
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    };
  }

  return {
    Authorization: `Bearer ${provider.apiKey}`,
    'Content-Type': 'application/json',
  };
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
  const apiModelId = resolveApiModelId(model);
  const endpoint = provider.endpointType === 'anthropic' ? 'chat' : inferBenchmarkEndpoint(apiModelId);
  const requestedTimeoutMs = options.timeoutMs ?? DEFAULT_BENCHMARK_TIMEOUT_MS;
  const timeoutMs = Number.isFinite(requestedTimeoutMs)
    ? Math.max(0, Math.floor(requestedTimeoutMs))
    : DEFAULT_BENCHMARK_TIMEOUT_MS;
  const start = performance.now();
  const controller = new AbortController();
  const externalSignal = options.signal;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let detachExternalAbort: (() => void) | undefined;
  let didTimeout = false;
  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
  }
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      const forwardAbort = () => controller.abort();
      externalSignal.addEventListener('abort', forwardAbort);
      detachExternalAbort = () => externalSignal.removeEventListener('abort', forwardAbort);
    }
  }

  try {
    const response = await providerFetch(buildBenchmarkUrl(provider, endpoint), {
      method: 'POST',
      headers: buildBenchmarkHeaders(provider),
      body: JSON.stringify(buildBenchmarkBody(apiModelId, endpoint, provider.endpointType)),
      signal: controller.signal,
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

    if (!isExpectedSuccessPayload(payload, endpoint)) {
      throw new Error('Unexpected benchmark response');
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
        error: didTimeout
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
    detachExternalAbort?.();
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
