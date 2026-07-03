type NotesSplitDiagnosticDetails = Record<string, unknown>;

interface NotesSplitDiagnosticEntry {
  details: NotesSplitDiagnosticDetails;
  sequence: number;
  time: string;
  timestampMs: number;
  type: string;
}

const MAX_NOTES_SPLIT_DIAGNOSTICS = 700;
const entries: NotesSplitDiagnosticEntry[] = [];
const listeners = new Set<() => void>();
let sequence = 0;

function getTimestampMs(): number {
  return typeof performance !== 'undefined' ? Math.round(performance.now()) : Date.now();
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function stringifyDetails(details: NotesSplitDiagnosticDetails): string {
  try {
    return JSON.stringify(details);
  } catch {
    return JSON.stringify({ serializationError: true });
  }
}

export function logNotesSplitDiagnostic(type: string, details: NotesSplitDiagnosticDetails = {}): void {
  sequence += 1;
  entries.push({
    details,
    sequence,
    time: new Date().toISOString(),
    timestampMs: getTimestampMs(),
    type,
  });

  if (entries.length > MAX_NOTES_SPLIT_DIAGNOSTICS) {
    entries.splice(0, entries.length - MAX_NOTES_SPLIT_DIAGNOSTICS);
  }

  notifyListeners();
}

export function clearNotesSplitDiagnostics(): void {
  entries.length = 0;
  sequence += 1;
  notifyListeners();
}

export function subscribeNotesSplitDiagnostics(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNotesSplitDiagnosticsVersion(): number {
  return sequence;
}

export function getNotesSplitDiagnosticEntries(): NotesSplitDiagnosticEntry[] {
  return entries.slice();
}

export function getNotesSplitDiagnosticsText(): string {
  const header = [
    'Vlaina notes split diagnostics',
    `createdAt=${new Date().toISOString()}`,
    `entryCount=${entries.length}`,
    typeof navigator !== 'undefined' ? `userAgent=${navigator.userAgent}` : null,
  ].filter(Boolean);

  const body = entries.map((entry) => (
    [
      entry.sequence,
      entry.time,
      `${entry.timestampMs}ms`,
      entry.type,
      stringifyDetails(entry.details),
    ].join('\t')
  ));

  return [...header, '', ...body].join('\n');
}
