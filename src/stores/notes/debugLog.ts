export function logNotesDebug(scope: string, payload?: unknown) {
  if (!import.meta.env.DEV) {
    return;
  }

  if (payload === undefined) {
    console.log(`[NotesDebug] ${scope}`);
    return;
  }

  console.log(`[NotesDebug] ${scope}`, payload);
}
