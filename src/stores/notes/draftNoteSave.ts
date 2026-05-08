import { ensureMarkdownFileName } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { getBaseName, getParentPath, joinPath, normalizePath, relativePath } from '@/lib/storage/adapter';
import { saveDialog } from '@/lib/storage/dialog';
import type { DraftNoteEntry } from './types';

function ensureMarkdownSavePath(path: string): string {
  if (isSupportedMarkdownPath(path)) {
    return path;
  }

  const fileName = ensureMarkdownFileName(getBaseName(path));
  const parentPath = getParentPath(path);
  const separator = path.includes('\\') ? '\\' : '/';

  return parentPath ? `${parentPath}${separator}${fileName}` : fileName;
}

async function buildDraftSaveDefaultPath(
  notesPath: string,
  draftNote: DraftNoteEntry,
): Promise<string> {
  const fileName = ensureMarkdownFileName(draftNote.name || 'Untitled');

  if (!notesPath) {
    return fileName;
  }

  if (draftNote.parentPath) {
    return joinPath(notesPath, draftNote.parentPath, fileName);
  }

  return joinPath(notesPath, fileName);
}

export async function chooseDraftSavePath(
  notesPath: string,
  draftNote: DraftNoteEntry,
): Promise<string | null> {
  const defaultPath = await buildDraftSaveDefaultPath(notesPath, draftNote);
  const selectedPath = await saveDialog({
    title: 'Save Note As',
    defaultPath,
    authorizeParentDirectory: true,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
  });

  return selectedPath ? ensureMarkdownSavePath(selectedPath) : null;
}

export function resolveDraftSaveLocation(
  selectedPath: string,
  notesPath: string,
): { absolutePath: string; relativePath: string | null } {
  const normalizedSelectedPath = normalizePath(selectedPath, true);
  const normalizedNotesPath = normalizePath(notesPath, true).replace(/\/+$/, '');

  if (
    normalizedNotesPath &&
    normalizedSelectedPath.startsWith(`${normalizedNotesPath}/`)
  ) {
    return {
      absolutePath: selectedPath,
      relativePath: relativePath(normalizedNotesPath, normalizedSelectedPath),
    };
  }

  return {
    absolutePath: selectedPath,
    relativePath: null,
  };
}
