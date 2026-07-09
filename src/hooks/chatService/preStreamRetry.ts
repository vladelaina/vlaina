import { isTransientEndpointPreStreamError } from '@/lib/ai/endpointFallback';
import { formatRetryStatusMessage } from '@/lib/ai/retryStatusMessage';

export const PRE_STREAM_RETRY_DELAY_MS = 900;
export const PRE_STREAM_VISIBLE_RETRY_DELAY_MS = 30_000;
export const PRE_STREAM_DEV_VISIBLE_RETRY_DELAY_MS = 1_000;
export const DEV_VISIBLE_RETRY_DELAY_STORAGE_KEY = 'vlaina_dev_visible_retry_delay_1s';
export const DEV_VISIBLE_RETRY_DELAY_CHANGED_EVENT = 'vlaina-dev-visible-retry-delay-changed';
export const DEV_RETRY_SIMULATION_STORAGE_KEY = 'vlaina_dev_retry_simulation';
export const DEV_RETRY_SIMULATION_CHANGED_EVENT = 'vlaina-dev-retry-simulation-changed';

const PRE_STREAM_QUICK_RETRY_COUNT = 3;
const PRE_STREAM_RETRY_STATUS_INTERVAL_MS = 1_000;
const PRE_STREAM_VISIBLE_RETRY_DELAY_STEP_MS = 15_000;
const PRE_STREAM_VISIBLE_RETRY_MAX_DELAY_MS = 60_000;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
    || !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError';
}

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw createAbortError();
}

function isTransientPreStreamError(error: unknown, signal?: AbortSignal): boolean {
  if (isAbortError(error) && signal?.aborted) {
    return false;
  }

  return isTransientEndpointPreStreamError(error);
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const abort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    const cleanupAndResolve = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };

    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(cleanupAndResolve, delayMs);
  });
}

export function isDevVisibleRetryDelayFastEnabled(): boolean {
  return Boolean(
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.localStorage.getItem(DEV_VISIBLE_RETRY_DELAY_STORAGE_KEY) === 'true'
  );
}

export function setDevVisibleRetryDelayFastEnabled(enabled: boolean): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  if (enabled) {
    window.localStorage.setItem(DEV_VISIBLE_RETRY_DELAY_STORAGE_KEY, 'true');
  } else {
    window.localStorage.removeItem(DEV_VISIBLE_RETRY_DELAY_STORAGE_KEY);
  }
  window.dispatchEvent(new Event(DEV_VISIBLE_RETRY_DELAY_CHANGED_EVENT));
}

export function isDevRetrySimulationEnabled(): boolean {
  return Boolean(
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.localStorage.getItem(DEV_RETRY_SIMULATION_STORAGE_KEY) === 'true'
  );
}

export function setDevRetrySimulationEnabled(enabled: boolean): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  if (enabled) {
    window.localStorage.setItem(DEV_RETRY_SIMULATION_STORAGE_KEY, 'true');
  } else {
    window.localStorage.removeItem(DEV_RETRY_SIMULATION_STORAGE_KEY);
  }
  window.dispatchEvent(new Event(DEV_RETRY_SIMULATION_CHANGED_EVENT));
}

function getVisibleRetryDelayMs(retryNumber: number): number {
  if (isDevVisibleRetryDelayFastEnabled() || isDevRetrySimulationEnabled()) {
    return PRE_STREAM_DEV_VISIBLE_RETRY_DELAY_MS;
  }

  const visibleRetryIndex = Math.max(1, retryNumber - PRE_STREAM_QUICK_RETRY_COUNT);
  return Math.min(
    PRE_STREAM_VISIBLE_RETRY_MAX_DELAY_MS,
    PRE_STREAM_VISIBLE_RETRY_DELAY_MS + (visibleRetryIndex - 1) * PRE_STREAM_VISIBLE_RETRY_DELAY_STEP_MS,
  );
}

async function waitForVisibleRetry(
  retryNumber: number,
  error: unknown,
  signal: AbortSignal | undefined,
  onRetryStatus: ((message: string) => void) | undefined,
): Promise<void> {
  const startedAt = Date.now();
  const delayMs = getVisibleRetryDelayMs(retryNumber);
  let remainingMs = delayMs;

  onRetryStatus?.(formatRetryStatusMessage(error, remainingMs, retryNumber));
  while (remainingMs > 0) {
    await waitForRetry(Math.min(PRE_STREAM_RETRY_STATUS_INTERVAL_MS, remainingMs), signal);
    remainingMs = delayMs - (Date.now() - startedAt);
    if (remainingMs > 0) {
      onRetryStatus?.(formatRetryStatusMessage(error, remainingMs, retryNumber));
    }
  }
}

export async function sendWithPreStreamRetry(
  send: (onChunk: (chunk: string) => void) => Promise<string>,
  onChunk: (chunk: string) => void,
  signal: AbortSignal | undefined,
  delayMs: number,
  shouldRetry: boolean,
  onRetryStatus?: (message: string) => void,
): Promise<string> {
  for (let retryCount = 0; ; retryCount += 1) {
    let didReceiveChunk = false;
    const trackedOnChunk = (chunk: string) => {
      throwIfAborted(signal);
      didReceiveChunk = true;
      onChunk(chunk);
      throwIfAborted(signal);
    };

    try {
      const result = await send(trackedOnChunk);
      throwIfAborted(signal);
      return result;
    } catch (error) {
      throwIfAborted(signal);
      if (!shouldRetry || didReceiveChunk || !isTransientPreStreamError(error, signal)) {
        throw error;
      }

      const nextRetryNumber = retryCount + 1;
      if (nextRetryNumber <= PRE_STREAM_QUICK_RETRY_COUNT) {
        await waitForRetry(delayMs, signal);
      } else {
        await waitForVisibleRetry(nextRetryNumber, error, signal, onRetryStatus);
      }
      throwIfAborted(signal);
    }
  }
}
