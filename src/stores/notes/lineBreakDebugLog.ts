interface NotesDebugEntry {
  timestamp: string;
  label: string;
  scope: string;
  payload?: unknown;
}

const notesDebugEntries: NotesDebugEntry[] = [];

export function isNotesDebugLoggingEnabled() {
  return false;
}

export function summarizeLineBreakText(text: string | null | undefined) {
  if (text == null) {
    return { length: null, lines: null };
  }

  return {
    length: text.length,
    lines: text.length === 0 ? 0 : text.split('\n').length,
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

  return {
    equal: firstDiffIndex === null,
    previousLength: previous.length,
    nextLength: next.length,
    lengthDelta: next.length - previous.length,
    previousLines,
    nextLines,
    lineDelta: nextLines - previousLines,
    firstDiffIndex,
  };
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

export function logNotesDebug(_label: string, _scope: string, _payload?: unknown) {
  notesDebugEntries.push({
    timestamp: new Date().toISOString(),
    label: _label,
    scope: _scope,
    payload: _payload,
  });
}

export function logLineBreakDebug(_scope: string, _payload?: unknown) {
  logNotesDebug('NotesLineBreak', _scope, _payload);
}

export function installGlobalNotesDebugHelpers() {
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
