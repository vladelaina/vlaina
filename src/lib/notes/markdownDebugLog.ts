const MAX_MARKDOWN_DEBUG_LOG_LINES = 300;

type MarkdownDebugValue = string | number | boolean | null | undefined;

const markdownDebugLogLines: string[] = [];

function formatDebugValue(value: MarkdownDebugValue): string {
  if (typeof value === 'string') {
    return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  }

  if (value === undefined) {
    return 'undefined';
  }

  return String(value);
}

export function logMarkdownDebug(
  event: string,
  details: Record<string, MarkdownDebugValue> = {},
): void {
  const timestamp = new Date().toISOString();
  const detailText = Object.entries(details)
    .map(([key, value]) => `${key}=${formatDebugValue(value)}`)
    .join(' ');
  const line = detailText
    ? `[${timestamp}] ${event} ${detailText}`
    : `[${timestamp}] ${event}`;

  markdownDebugLogLines.push(line);
  if (markdownDebugLogLines.length > MAX_MARKDOWN_DEBUG_LOG_LINES) {
    markdownDebugLogLines.splice(0, markdownDebugLogLines.length - MAX_MARKDOWN_DEBUG_LOG_LINES);
  }

  if (import.meta.env.DEV && !import.meta.env.VITEST) {
    console.info(`[markdown-debug] ${event}`, details);
  }
}

export function getMarkdownDebugLogText(extra: Record<string, MarkdownDebugValue> = {}): string {
  const header = [
    `Markdown debug log copied at ${new Date().toISOString()}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${formatDebugValue(value)}`),
  ];

  return [...header, '', ...markdownDebugLogLines].join('\n');
}
