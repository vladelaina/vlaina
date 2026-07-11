import { translate } from '@/lib/i18n';

const RETRY_COUNTDOWN_NUMBER_PATTERN = /\d+/g;

function primitiveToString(value: unknown): string {
  if (value == null) {
    return '';
  }
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'bigint':
    case 'symbol':
      return String(value);
    default:
      return '';
  }
}

export function extractRetryErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    const message = (error as { message: string }).message.trim();
    if (message) {
      return message;
    }
  }
  return primitiveToString(error).trim() || 'AI request failed.';
}

export function formatRetryCountdown(delayMs: number, retryNumber: number): string {
  const seconds = Math.max(1, Math.ceil(delayMs / 1000));
  return translate('chat.retryCountdown', { seconds, attempt: retryNumber });
}

export function formatRetryStatusMessage(error: unknown, delayMs: number, retryNumber: number): string {
  return `${extractRetryErrorDetail(error)}\n${formatRetryCountdown(delayMs, retryNumber)}`;
}

export function isRetryCountdownLine(content: string): boolean {
  const line = content.trim();
  const numericParts = [...line.matchAll(RETRY_COUNTDOWN_NUMBER_PATTERN)]
    .map((match) => Number(match[0]))
    .filter(Number.isFinite);

  for (const seconds of numericParts) {
    for (const attempt of numericParts) {
      if (translate('chat.retryCountdown', { seconds, attempt }) === line) {
        return true;
      }
    }
  }

  return false;
}

export function parseRetryStatusMessage(content: string): { detail: string; countdown: string } | null {
  const lines = content.replace(/\r\n?/g, '\n').trimEnd().split('\n');
  const countdown = lines.at(-1)?.trim() ?? '';
  if (!isRetryCountdownLine(countdown)) {
    return null;
  }

  return {
    detail: lines.slice(0, -1).join('\n').trim(),
    countdown,
  };
}

export function isRetryStatusMessage(content: string): boolean {
  return parseRetryStatusMessage(content) !== null;
}
