type ConsoleLevel = 'debug' | 'error' | 'info' | 'log' | 'warn';

const MAX_CONSOLE_LOG_ENTRIES = 5000;
const CONSOLE_LEVELS: ConsoleLevel[] = ['debug', 'error', 'info', 'log', 'warn'];

interface ConsoleLogEntry {
  timestamp: string;
  level: string;
  text: string;
}

const entries: ConsoleLogEntry[] = [];
let didInstallConsoleLogCapture = false;

function stringifyConsoleValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function appendConsoleLogEntry(level: string, values: readonly unknown[]): void {
  entries.push({
    timestamp: new Date().toISOString(),
    level,
    text: values.map(stringifyConsoleValue).join(' '),
  });

  if (entries.length > MAX_CONSOLE_LOG_ENTRIES) {
    entries.splice(0, entries.length - MAX_CONSOLE_LOG_ENTRIES);
  }
}

export function getConsoleLogText(): string {
  return entries
    .map((entry) => `[${entry.timestamp}] [${entry.level}] ${entry.text}`)
    .join('\n');
}

export function clearConsoleLogBuffer(): void {
  entries.length = 0;
}

export function installConsoleLogCapture(): void {
  if (didInstallConsoleLogCapture || typeof window === 'undefined') return;
  didInstallConsoleLogCapture = true;

  for (const level of CONSOLE_LEVELS) {
    const original = console[level].bind(console);
    console[level] = (...values: unknown[]) => {
      appendConsoleLogEntry(level, values);
      original(...values);
    };
  }

  window.addEventListener('error', (event) => {
    appendConsoleLogEntry('error', [
      event.error ?? event.message,
      event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : '',
    ]);
  });

  window.addEventListener('unhandledrejection', (event) => {
    appendConsoleLogEntry('unhandledrejection', [event.reason]);
  });
}
