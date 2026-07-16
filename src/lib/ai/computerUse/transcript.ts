import type { ApiTranscriptMessage } from '@/lib/ai/types';
import {
  COMPUTER_COMMAND_RESULT_KIND,
  COMPUTER_COMMAND_RESULT_VERSION,
  COMPUTER_COMMAND_TOOL_NAME,
  type ComputerCommandPhase,
  type ComputerCommandStatus,
} from './types';
import { sanitizeComputerCommandText } from './textSanitizer';
import { normalizeComputerFileChanges } from './fileChanges';
import {
  MAX_COMPUTER_COMMAND_STATUSES,
  MAX_COMPUTER_COMMAND_STATUS_OUTPUT_CHARS,
  MAX_DESKTOP_COMMAND_CHARS,
  MAX_DESKTOP_COMMAND_CWD_CHARS,
  MAX_DESKTOP_COMMAND_PURPOSE_CHARS,
} from './toolLimits';

const VALID_PHASES = new Set<ComputerCommandPhase>([
  'awaiting_approval',
  'running',
  'completed',
  'failed',
  'denied',
  'cancelled',
  'timed_out',
  'interrupted',
]);
function parseToolResult(message: ApiTranscriptMessage): Record<string, unknown> | null {
  if (typeof message.content !== 'string' || message.content.length > 256 * 1024) return null;
  try {
    const parsed = JSON.parse(message.content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function normalizeStatus(
  toolCallId: string,
  result: Record<string, unknown>,
  isLoading: boolean,
): ComputerCommandStatus | null {
  if (
    result.kind !== COMPUTER_COMMAND_RESULT_KIND ||
    result.version !== COMPUTER_COMMAND_RESULT_VERSION ||
    typeof result.phase !== 'string' ||
    !VALID_PHASES.has(result.phase as ComputerCommandPhase)
  ) return null;
  const command = sanitizeComputerCommandText(result.command, MAX_DESKTOP_COMMAND_CHARS).trim();
  if (!command) return null;
  const rawPhase = result.phase as ComputerCommandPhase;
  const phase = !isLoading && (rawPhase === 'awaiting_approval' || rawPhase === 'running')
    ? 'interrupted'
    : rawPhase;
  const cwd = sanitizeComputerCommandText(result.cwd, MAX_DESKTOP_COMMAND_CWD_CHARS).trim();
  const purpose = sanitizeComputerCommandText(result.purpose, MAX_DESKTOP_COMMAND_PURPOSE_CHARS).trim();
  const stdout = sanitizeComputerCommandText(result.stdout, MAX_COMPUTER_COMMAND_STATUS_OUTPUT_CHARS);
  const stderr = sanitizeComputerCommandText(result.stderr, MAX_COMPUTER_COMMAND_STATUS_OUTPUT_CHARS);
  const fileChanges = normalizeComputerFileChanges(result.fileChanges);
  return {
    id: toolCallId,
    phase,
    command,
    cwd,
    ...(purpose ? { purpose } : {}),
    ...(stdout ? { stdout } : {}),
    ...(stderr ? { stderr } : {}),
    ...(fileChanges.length > 0 ? { fileChanges } : {}),
    ...(result.fileChangesTruncated === true ? { fileChangesTruncated: true } : {}),
    ...(typeof result.exitCode === 'number' || result.exitCode === null ? { exitCode: result.exitCode } : {}),
    ...(typeof result.signal === 'string' || result.signal === null ? { signal: result.signal } : {}),
    ...(result.truncated === true ? { truncated: true } : {}),
    ...(typeof result.durationMs === 'number' && Number.isFinite(result.durationMs)
      ? { durationMs: Math.max(0, Math.round(result.durationMs)) }
      : {}),
    updatedAt: typeof result.updatedAt === 'number' && Number.isFinite(result.updatedAt)
      ? result.updatedAt
      : 0,
  };
}

export function extractComputerCommandStatuses(
  transcript: ApiTranscriptMessage[] | undefined,
  isLoading: boolean,
): ComputerCommandStatus[] {
  if (!Array.isArray(transcript)) return [];
  const pending = new Map<string, boolean>();
  const statuses: ComputerCommandStatus[] = [];

  for (const message of transcript) {
    if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) {
        if (call.function.name !== COMPUTER_COMMAND_TOOL_NAME) continue;
        if (!call.id) continue;
        pending.set(call.id, true);
      }
      continue;
    }
    if (message.role !== 'tool' || !message.tool_call_id || !pending.has(message.tool_call_id)) continue;
    const result = parseToolResult(message);
    if (!result) continue;
    const status = normalizeStatus(message.tool_call_id, result, isLoading);
    if (status) statuses.push(status);
    pending.delete(message.tool_call_id);
  }

  return statuses.slice(-MAX_COMPUTER_COMMAND_STATUSES);
}
