import { logDiagnostic } from '@/lib/diagnostics/diagnosticsLog';

export type ChatDebugLogLevel = 'info' | 'warn' | 'error';

const NUMERIC_FIELDS = new Set([
  'attempt',
  'attemptedUrls',
  'attempts',
  'attachments',
  'durationMs',
  'failureCount',
  'finalChars',
  'loopIndex',
  'loops',
  'mentions',
  'messages',
  'reasoningChars',
  'resultCount',
  'status',
  'successCount',
  'textLength',
  'transcriptMessages',
  'visibleChars',
]);

const BOOLEAN_FIELDS = new Set([
  'exhausted',
  'hasResults',
  'successfulRead',
  'webSearchEnabled',
]);

const IDENTIFIER_FIELDS = new Set([
  'mode',
  'model',
  'modelId',
  'provider',
  'providerId',
]);

function sanitizeLabel(value: string, fallback: string): string {
  return /^[A-Za-z0-9][A-Za-z0-9 .:;_-]{0,119}$/.test(value) ? value : fallback;
}

function sanitizeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 120) return undefined;
  if (value.includes('://')) return undefined;
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value) ? value : undefined;
}

function classifyError(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;

  if (/does not support this input|unsupported (?:file|input)|unsupported_(?:model_input|message_content)/i.test(value)) {
    return 'unsupported-input';
  }
  if (/no endpoints found that support tool use|(?:tool|function call).*(?:not support|unsupported|unavailable)/i.test(value)) {
    return 'tool-input-unsupported';
  }
  if (/rate.?limit|too many requests|quota/i.test(value)) return 'rate-limit';
  if (/unauthori[sz]ed|forbidden|api.?key|authentication/i.test(value)) return 'auth';
  if (/timed?\s*out|timeout/i.test(value)) return 'timeout';
  if (/abort|cancel/i.test(value)) return 'aborted';
  if (/network|fetch failed|connection|econn|dns/i.test(value)) return 'network';
  if (/no results?|empty result/i.test(value)) return 'no-results';
  if (/invalid request|bad request|validation/i.test(value)) return 'invalid-request';
  return 'unknown';
}

function sanitizeToolNames(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const names = value
    .map((item) => typeof item === 'string'
      ? item
      : item && typeof item === 'object' && 'name' in item
        ? (item as { name?: unknown }).name
        : undefined)
    .map(sanitizeIdentifier)
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.slice(0, 12) : undefined;
}

function sanitizeMetrics(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const metrics: Record<string, number> = {};
  for (const key of ['durationMs', 'resultCount', 'successCount', 'failureCount']) {
    const metric = (value as Record<string, unknown>)[key];
    if (typeof metric === 'number' && Number.isFinite(metric)) metrics[key] = metric;
  }
  return Object.keys(metrics).length > 0 ? metrics : undefined;
}

function sanitizeDetails(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  if (!data) return details;

  for (const [key, value] of Object.entries(data)) {
    if (NUMERIC_FIELDS.has(key) && typeof value === 'number' && Number.isFinite(value)) {
      details[key] = value;
    } else if (BOOLEAN_FIELDS.has(key) && typeof value === 'boolean') {
      details[key] = value;
    } else if (IDENTIFIER_FIELDS.has(key)) {
      const identifier = sanitizeIdentifier(value);
      if (identifier) details[key] = identifier;
    } else if (key === 'query' && typeof value === 'string') {
      details.queryLength = value.length;
    } else if ((key === 'urls' || key === 'sourceUrls') && Array.isArray(value)) {
      details[key === 'urls' ? 'urlCount' : 'sourceUrlCount'] = value.length;
    } else if (key === 'toolCalls' || key === 'skippedToolCalls') {
      const toolNames = sanitizeToolNames(value);
      if (toolNames) details[key] = toolNames;
    } else if (key === 'metrics') {
      const metrics = sanitizeMetrics(value);
      if (metrics) details.metrics = metrics;
    } else if (key === 'error' || key === 'message') {
      const errorCategory = classifyError(value);
      if (errorCategory) details.errorCategory = errorCategory;
    }
  }
  return details;
}

export function addChatDebugLog(
  scope: string,
  message: string,
  data?: Record<string, unknown>,
  level: ChatDebugLogLevel = 'info',
) {
  logDiagnostic('chat', sanitizeLabel(message, 'chat event'), {
    level,
    scope: sanitizeLabel(scope, 'chat'),
    ...sanitizeDetails(data),
  });
}
