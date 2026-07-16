import type { ElectronComputerCommandResult } from '@/lib/electron/bridge';
import { MAX_API_TRANSCRIPT_STRING_CHARS } from '@/lib/ai/apiTranscript';
import {
  COMPUTER_COMMAND_RESULT_KIND,
  COMPUTER_COMMAND_RESULT_VERSION,
  type ComputerCommandPhase,
  type ComputerCommandStatus,
  type ComputerCommandToolResult,
  type ParsedComputerCommandArguments,
} from './types';
import { MAX_COMPUTER_COMMAND_STATUS_OUTPUT_CHARS } from './toolLimits';
import { sanitizeComputerCommandText } from './textSanitizer';
import { normalizeComputerFileChanges } from './fileChanges';

function clipOutput(value: unknown): string {
  return sanitizeComputerCommandText(value, MAX_COMPUTER_COMMAND_STATUS_OUTPUT_CHARS);
}

export function buildComputerCommandStatus(
  id: string,
  phase: ComputerCommandPhase,
  args: ParsedComputerCommandArguments,
  result: Partial<ElectronComputerCommandResult> = {},
): ComputerCommandStatus {
  const fileChanges = normalizeComputerFileChanges(result.fileChanges);
  return {
    id,
    phase,
    command: result.command || args.command,
    cwd: result.cwd || args.cwd || '',
    ...(args.purpose ? { purpose: args.purpose } : {}),
    ...(result.stdout ? { stdout: clipOutput(result.stdout) } : {}),
    ...(result.stderr ? { stderr: clipOutput(result.stderr) } : {}),
    ...(result.exitCode !== undefined ? { exitCode: result.exitCode } : {}),
    ...(result.signal !== undefined ? { signal: result.signal } : {}),
    ...(result.truncated ? { truncated: true } : {}),
    ...(typeof result.durationMs === 'number' ? { durationMs: Math.max(0, Math.round(result.durationMs)) } : {}),
    ...(fileChanges.length > 0 ? { fileChanges } : {}),
    ...(result.fileChangesTruncated ? { fileChangesTruncated: true } : {}),
    updatedAt: Date.now(),
  };
}

export function serializeComputerCommandStatus(
  status: ComputerCommandStatus,
  options: { includeFileChanges?: boolean } = {},
): string {
  const { id: _id, ...result } = status;
  const payload: ComputerCommandToolResult = {
    kind: COMPUTER_COMMAND_RESULT_KIND,
    version: COMPUTER_COMMAND_RESULT_VERSION,
    ...result,
  };
  if (options.includeFileChanges === false) {
    delete payload.fileChanges;
    delete payload.fileChangesTruncated;
  }
  const serialized = JSON.stringify(payload);
  if (serialized.length <= MAX_API_TRANSCRIPT_STRING_CHARS) return serialized;

  const stdout = payload.stdout || '';
  const stderr = payload.stderr || '';
  const compact: ComputerCommandToolResult = { ...payload };
  delete compact.stdout;
  delete compact.stderr;

  if (JSON.stringify(compact).length > MAX_API_TRANSCRIPT_STRING_CHARS) {
    delete compact.fileChanges;
    compact.fileChangesTruncated = true;
  }

  if (JSON.stringify(compact).length > MAX_API_TRANSCRIPT_STRING_CHARS) {
    delete compact.purpose;
  }

  if (JSON.stringify(compact).length > MAX_API_TRANSCRIPT_STRING_CHARS && compact.cwd) {
    const originalCwd = compact.cwd;
    let low = 0;
    let high = originalCwd.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      compact.cwd = middle < originalCwd.length ? `…${originalCwd.slice(-middle)}` : originalCwd;
      if (JSON.stringify(compact).length <= MAX_API_TRANSCRIPT_STRING_CHARS) low = middle;
      else high = middle - 1;
    }
    compact.cwd = low > 0
      ? low < originalCwd.length ? `…${originalCwd.slice(-low)}` : originalCwd
      : '';
  }

  const outputLength = stdout.length + stderr.length;
  const withOutputBudget = (budget: number): ComputerCommandToolResult => {
    const next = { ...compact };
    if (payload.truncated || budget < outputLength) next.truncated = true;
    else delete next.truncated;
    let stdoutBudget = stderr ? Math.min(stdout.length, Math.ceil(budget / 2)) : Math.min(stdout.length, budget);
    let stderrBudget = Math.min(stderr.length, budget - stdoutBudget);
    let remaining = budget - stdoutBudget - stderrBudget;
    if (remaining > 0) {
      const stdoutExtra = Math.min(stdout.length - stdoutBudget, remaining);
      stdoutBudget += stdoutExtra;
      remaining -= stdoutExtra;
      stderrBudget += Math.min(stderr.length - stderrBudget, remaining);
    }
    if (stdoutBudget > 0) next.stdout = stdout.slice(-stdoutBudget);
    if (stderrBudget > 0) next.stderr = stderr.slice(-stderrBudget);
    return next;
  };

  let low = 0;
  let high = outputLength;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (JSON.stringify(withOutputBudget(middle)).length <= MAX_API_TRANSCRIPT_STRING_CHARS) low = middle;
    else high = middle - 1;
  }
  return JSON.stringify(withOutputBudget(low));
}
