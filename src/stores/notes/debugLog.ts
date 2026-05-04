type NotesDebugWindow = Window & {
  __vlainaNotesDebugDump?: () => string;
  __vlainaCopyNotesDebug?: () => Promise<{ ok: boolean; chars: number; error?: string }>;
};

const notesDebugBuffer: string[] = [];
const MAX_NOTES_DEBUG_LINES = 500;
let debugHelpersRegistered = false;

function formatPayload(payload: unknown): string {
  if (payload === undefined) {
    return '';
  }

  try {
    return ` ${JSON.stringify(payload, null, 2)}`;
  } catch {
    return ` ${String(payload)}`;
  }
}

function appendDebugLine(line: string) {
  notesDebugBuffer.push(line);
  if (notesDebugBuffer.length > MAX_NOTES_DEBUG_LINES) {
    notesDebugBuffer.splice(0, notesDebugBuffer.length - MAX_NOTES_DEBUG_LINES);
  }
}

function getDebugDump() {
  return notesDebugBuffer.join('\n');
}

function registerDebugHelpers(win: NotesDebugWindow) {
  if (debugHelpersRegistered) {
    return;
  }

  debugHelpersRegistered = true;
  win.__vlainaNotesDebugDump = getDebugDump;
  win.__vlainaCopyNotesDebug = async () => {
    const text = getDebugDump();
    try {
      if (win.vlainaDesktop?.clipboard?.writeText) {
        await win.vlainaDesktop.clipboard.writeText(text);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('No clipboard writer is available');
      }

      return { ok: true, chars: text.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[NotesDebug] failed to copy debug log', error);
      return { ok: false, chars: text.length, error: message };
    }
  };
}

export function logNotesDebug(scope: string, payload?: unknown) {
  if (typeof window === 'undefined') {
    return;
  }

  registerDebugHelpers(window as NotesDebugWindow);

  const debugSetting = window.localStorage.getItem('vlaina:debug:notes');
  if (debugSetting === '0' || (!import.meta.env.DEV && debugSetting !== '1')) {
    return;
  }

  appendDebugLine(`[${new Date().toISOString()}] ${scope}${formatPayload(payload)}`);
}

if (typeof window !== 'undefined') {
  registerDebugHelpers(window as NotesDebugWindow);
}
