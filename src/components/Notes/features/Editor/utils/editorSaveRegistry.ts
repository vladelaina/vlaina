type EditorSaveFlusher = () => void | Promise<void>;

let currentEditorSaveFlusher: EditorSaveFlusher | null = null;

export function registerCurrentEditorSaveFlusher(flusher: EditorSaveFlusher) {
  currentEditorSaveFlusher = flusher;
  return () => {
    if (currentEditorSaveFlusher === flusher) currentEditorSaveFlusher = null;
  };
}

export async function flushCurrentEditorSave() {
  await currentEditorSaveFlusher?.();
}
