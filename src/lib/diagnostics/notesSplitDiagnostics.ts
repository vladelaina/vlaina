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
let sequence = 0;

function getTimestampMs(): number {
  return typeof performance !== 'undefined' ? Math.round(performance.now()) : Date.now();
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
}
