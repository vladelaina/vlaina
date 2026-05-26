export type ChatDebugLogLevel = 'info' | 'warn' | 'error';

export interface ChatDebugLogEntry {
  id: string;
  timestamp: number;
  level: ChatDebugLogLevel;
  scope: string;
  message: string;
  data?: Record<string, unknown>;
}

const MAX_LOG_ENTRIES = 300;
const listeners = new Set<() => void>();
let entries: ChatDebugLogEntry[] = [];

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function sanitizeData(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return undefined;
  try {
    return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  } catch {
    return { note: 'Unable to serialize debug payload.' };
  }
}

export function addChatDebugLog(
  scope: string,
  message: string,
  data?: Record<string, unknown>,
  level: ChatDebugLogLevel = 'info',
) {
  entries = [
    ...entries,
    {
      id: `chat-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      level,
      scope,
      message,
      data: sanitizeData(data),
    },
  ].slice(-MAX_LOG_ENTRIES);
  emit();
}

export function clearChatDebugLog() {
  entries = [];
  emit();
}

export function getChatDebugLogSnapshot(): ChatDebugLogEntry[] {
  return entries;
}

export function subscribeChatDebugLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function formatChatDebugLog(entriesToFormat: ChatDebugLogEntry[] = entries): string {
  return entriesToFormat
    .map((entry) => {
      const time = new Date(entry.timestamp).toISOString();
      const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
      return `[${time}] ${entry.level.toUpperCase()} ${entry.scope}: ${entry.message}${data}`;
    })
    .join('\n');
}
