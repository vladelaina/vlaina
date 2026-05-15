import { MANAGED_API_BASE } from './constants';
import { parseManagedError } from './errors';
import { createStreamAccumulator } from '@/lib/ai/streaming';

const MANAGED_JSON_TIMEOUT_MS = 30_000;
const MANAGED_STREAM_TIMEOUT_MS = 300_000;

function publicManagedStreamErrorMessage(message: string | undefined, errorCode: string | undefined): string {
  const normalizedCode = typeof errorCode === 'string' ? errorCode.trim().toLowerCase() : '';
  switch (normalizedCode) {
    case 'points_exhausted':
    case 'inactive_points':
    case 'insufficient_points':
      return 'MANAGED_QUOTA_EXHAUSTED';
    case 'upstream_rate_limited':
      return 'UPSTREAM_RATE_LIMITED';
    case 'upstream_unavailable':
      return 'UPSTREAM_UNAVAILABLE';
    case 'invalid_request':
      return 'INVALID_REQUEST';
    default:
      return message === 'UPSTREAM_UNAVAILABLE' || message === 'UPSTREAM_RATE_LIMITED'
        ? message
        : 'Managed API request failed: HTTP 502';
  }
}

export async function requestManagedWebJson<T>(path: string, init?: RequestInit): Promise<T> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), MANAGED_JSON_TIMEOUT_MS);

  const combinedSignal = init?.signal
    ? AbortSignal.any([init.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${MANAGED_API_BASE}${path}`, {
      ...init,
      signal: combinedSignal,
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw await parseManagedError(response);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

export async function requestManagedWebStream(
  path: string,
  body: Record<string, unknown>,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), MANAGED_STREAM_TIMEOUT_MS);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${MANAGED_API_BASE}${path}`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      signal: combinedSignal,
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw await parseManagedError(response);
    }

    if (!response.body) {
      throw new Error('Managed API response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const accumulator = createStreamAccumulator(onChunk);

    const consumeLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]' || trimmed === 'data:[DONE]') {
        return;
      }

      if (!trimmed.startsWith('data:')) {
        return;
      }

      const jsonStr = trimmed.slice(5).trim();
      let payload: {
        error?: {
          code?: string;
          message?: string;
        };
        choices?: Array<{
          delta?: {
            content?: string;
            reasoning_content?: string;
          };
        }>;
      };
      try {
        payload = JSON.parse(jsonStr) as typeof payload;
      } catch (parseError) {
        if (import.meta.env.DEV) {
          console.warn('[managedService] SSE line parse failed:', parseError);
        }
        return;
      }

      if (payload.error?.message) {
        const error = new Error(publicManagedStreamErrorMessage(payload.error.message, payload.error.code)) as Error & {
          errorCode?: string;
        };
        if (typeof payload.error.code === 'string' && payload.error.code.trim()) {
          error.errorCode = payload.error.code.trim();
        }
        throw error;
      }

      const delta = payload.choices?.[0]?.delta;
      const reasoning = delta?.reasoning_content;
      const content = delta?.content;

      if (reasoning || content) {
        accumulator.pushDelta({ reasoning, content });
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          consumeLine(line);
        }
      }

      if (buffer.trim()) {
        consumeLine(buffer);
      }

      return accumulator.finish();
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }
  } finally {
    clearTimeout(timer);
  }
}
