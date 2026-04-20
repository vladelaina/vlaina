export function logNotesDebug(scope: string, payload?: unknown) {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return;
  }

  if (window.localStorage.getItem('vlaina:debug:notes') !== '1') {
    return;
  }

  if (payload === undefined) {
    console.log(`[NotesDebug] ${scope}`);
    return;
  }

  console.log(`[NotesDebug] ${scope}`, payload);
}
