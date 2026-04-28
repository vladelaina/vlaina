import { MANAGED_API_BASE } from './constants';
import { parseManagedError } from './errors';

const MANAGED_JSON_TIMEOUT_MS = 30_000;

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
  const response = await fetch(`${MANAGED_API_BASE}${path}`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
    signal,
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
  let fullContent = '';
  let buffer = '';
  let hasStartedReasoning = false;
  let hasFinishedReasoning = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') {
        continue;
      }

      if (!trimmed.startsWith('data: ')) {
        continue;
      }

      try {
        const jsonStr = trimmed.slice(6);
        const payload = JSON.parse(jsonStr) as {
          choices?: Array<{
            delta?: {
              content?: string;
              reasoning_content?: string;
            };
          }>;
        };
        const delta = payload.choices?.[0]?.delta;
        const reasoning = delta?.reasoning_content;
        const content = delta?.content;

        if (reasoning) {
          if (!hasStartedReasoning) {
            fullContent += '<think>';
            hasStartedReasoning = true;
          }
          fullContent += reasoning;
        }

        if (content) {
          if (hasStartedReasoning && !hasFinishedReasoning) {
            fullContent += '</think>';
            hasFinishedReasoning = true;
          }
          fullContent += content;
        }

        if (reasoning || content) {
          onChunk(fullContent);
        }
      } catch (parseError) {
        if (import.meta.env.DEV) {
          console.warn('[managedService] SSE line parse failed:', parseError);
        }
      }
    }
  }

  if (hasStartedReasoning && !hasFinishedReasoning) {
    fullContent += '</think>';
  }

  return fullContent;
}
