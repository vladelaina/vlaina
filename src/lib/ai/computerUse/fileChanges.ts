import { sanitizeComputerCommandText } from './textSanitizer';
import type { ComputerFileChange } from './types';

const MAX_FILE_CHANGES = 12;
const MAX_CHANGE_PATH_CHARS = 256;
const MAX_CHANGE_PATCH_CHARS = 4000;
const MAX_CHANGE_LINE_COUNT = 1_000_000;
const CHANGE_KINDS = new Set<ComputerFileChange['kind']>(['added', 'modified', 'deleted']);

function boundedLineCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_CHANGE_LINE_COUNT, Math.max(0, Math.round(value)))
    : 0;
}

export function normalizeComputerFileChanges(value: unknown): ComputerFileChange[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_FILE_CHANGES).flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const path = sanitizeComputerCommandText(record.path, MAX_CHANGE_PATH_CHARS).trim();
    const kind = record.kind as ComputerFileChange['kind'];
    if (!path || !CHANGE_KINDS.has(kind)) return [];
    const patch = sanitizeComputerCommandText(record.patch, MAX_CHANGE_PATCH_CHARS);
    return [{
      path,
      kind,
      additions: boundedLineCount(record.additions),
      deletions: boundedLineCount(record.deletions),
      ...(patch ? { patch } : {}),
      ...(record.truncated === true ? { truncated: true } : {}),
    }];
  });
}
