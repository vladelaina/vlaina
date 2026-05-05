const MAX_NOTES_DEBUG_ENTRIES = 5000;

interface NotesDebugEntry {
  timestamp: string;
  label: string;
  scope: string;
  payload?: unknown;
}

const notesDebugEntries: NotesDebugEntry[] = [];

export function summarizeLineBreakText(text: string | null | undefined) {
  if (text == null) {
    return { length: null, lines: null, preview: null };
  }

  return {
    length: text.length,
    lines: text.length === 0 ? 0 : text.split('\n').length,
    preview: text.replace(/\r/g, '\\r').replace(/\n/g, '\\n').slice(0, 500),
  };
}

export function compareLineBreakText(
  previous: string | null | undefined,
  next: string | null | undefined,
) {
  if (previous == null || next == null) {
    return {
      equal: previous === next,
      previousLength: previous == null ? null : previous.length,
      nextLength: next == null ? null : next.length,
      previousLines: previous == null ? null : previous.length === 0 ? 0 : previous.split('\n').length,
      nextLines: next == null ? null : next.length === 0 ? 0 : next.split('\n').length,
      firstDiffIndex: null,
      previousAroundDiff: null,
      nextAroundDiff: null,
    };
  }

  const maxLength = Math.max(previous.length, next.length);
  let firstDiffIndex: number | null = null;
  for (let index = 0; index < maxLength; index += 1) {
    if (previous[index] !== next[index]) {
      firstDiffIndex = index;
      break;
    }
  }

  const previousLines = previous.length === 0 ? 0 : previous.split('\n').length;
  const nextLines = next.length === 0 ? 0 : next.split('\n').length;
  const start = firstDiffIndex === null ? 0 : Math.max(0, firstDiffIndex - 80);
  const end = firstDiffIndex === null ? 0 : firstDiffIndex + 160;

  return {
    equal: firstDiffIndex === null,
    previousLength: previous.length,
    nextLength: next.length,
    lengthDelta: next.length - previous.length,
    previousLines,
    nextLines,
    lineDelta: nextLines - previousLines,
    firstDiffIndex,
    previousAroundDiff: firstDiffIndex === null
      ? null
      : previous.slice(start, end).replace(/\r/g, '\\r').replace(/\n/g, '\\n'),
    nextAroundDiff: firstDiffIndex === null
      ? null
      : next.slice(start, end).replace(/\r/g, '\\r').replace(/\n/g, '\\n'),
  };
}

function stringifyDebugPayload(payload: unknown) {
  if (payload === undefined) {
    return '';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function formatNotesDebugEntry(entry: NotesDebugEntry) {
  const payload = stringifyDebugPayload(entry.payload);
  return payload
    ? `[${entry.timestamp}] [${entry.label}] ${entry.scope} ${payload}`
    : `[${entry.timestamp}] [${entry.label}] ${entry.scope}`;
}

export function getNotesDebugLogText() {
  return notesDebugEntries.map(formatNotesDebugEntry).join('\n');
}

export function getLineBreakDebugLogText() {
  return getNotesDebugLogText();
}

export function clearNotesDebugLog() {
  notesDebugEntries.length = 0;
}

export function clearLineBreakDebugLog() {
  clearNotesDebugLog();
}

export function logNotesDebug(label: string, scope: string, payload?: unknown) {
  notesDebugEntries.push({
    timestamp: new Date().toISOString(),
    label,
    scope,
    payload,
  });

  if (notesDebugEntries.length > MAX_NOTES_DEBUG_ENTRIES) {
    notesDebugEntries.splice(0, notesDebugEntries.length - MAX_NOTES_DEBUG_ENTRIES);
  }

  console.info(`[${label}]`, scope, payload ?? '');
}

export function logLineBreakDebug(scope: string, payload?: unknown) {
  logNotesDebug('NotesLineBreak', scope, payload);
}
