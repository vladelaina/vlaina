import {
  MAX_DESKTOP_COMMAND_CHARS,
  MAX_DESKTOP_COMMAND_CWD_CHARS,
  MAX_DESKTOP_COMMAND_PURPOSE_CHARS,
} from './toolLimits';
import type { ParsedComputerCommandArguments } from './types';

const UNSAFE_DISPLAY_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\uFFFD]/u;

function boundedString(value: unknown, maxChars: number): string {
  return typeof value === 'string' && value.length <= maxChars ? value.trim() : '';
}

function isAbsoluteDesktopPath(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\');
}

export function parseComputerCommandArguments(value: string): ParsedComputerCommandArguments | null {
  if (typeof value !== 'string' || value.length > 64 * 1024) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if ([record.command, record.cwd, record.purpose].some(
    (entry) => typeof entry === 'string' && UNSAFE_DISPLAY_CHARS.test(entry),
  )) return null;
  const command = boundedString(record.command, MAX_DESKTOP_COMMAND_CHARS);
  const purpose = boundedString(record.purpose, MAX_DESKTOP_COMMAND_PURPOSE_CHARS);
  const cwd = boundedString(record.cwd, MAX_DESKTOP_COMMAND_CWD_CHARS);
  if (!command || !purpose) return null;
  if (cwd && !isAbsoluteDesktopPath(cwd)) return null;
  const rawTimeout = record.timeout_seconds ?? record.timeoutSeconds;
  const timeoutSeconds = typeof rawTimeout === 'number' && Number.isFinite(rawTimeout)
    ? Math.round(rawTimeout)
    : undefined;
  if (timeoutSeconds !== undefined && (timeoutSeconds < 1 || timeoutSeconds > 1800)) return null;
  return {
    command,
    ...(cwd ? { cwd } : {}),
    ...(purpose ? { purpose } : {}),
    ...(timeoutSeconds !== undefined ? { timeoutSeconds } : {}),
  };
}
