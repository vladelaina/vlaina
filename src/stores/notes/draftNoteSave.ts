import { ensureMarkdownFileName } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { getBaseName, getParentPath, joinPath, normalizeAbsolutePath, normalizePath } from '@/lib/storage/adapter';
import { saveDialog } from '@/lib/storage/dialog';
import { translate } from '@/lib/i18n/runtime';
import type { DraftNoteEntry } from './types';
import { hasInternalNotePathSegment } from './utils/fs/internalNotePaths';

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
    title: translate('notes.saveNoteAs'),
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
  const normalizedSelectedPath = normalizeAbsolutePath(normalizePath(selectedPath, true)).replace(/\\/g, '/');
  const normalizedNotesPath = normalizeAbsolutePath(normalizePath(notesPath, true)).replace(/\\/g, '/');
  const normalizedNotesRootRoot = normalizedNotesPath === '/'
    ? '/'
    : normalizedNotesPath.replace(/\/+$/, '');
  const selectedPathKey = getDraftSavePathComparisonKey(normalizedSelectedPath);
  const notesRootRootKey = getDraftSavePathComparisonKey(normalizedNotesRootRoot);
  const notesRootPrefixKey = notesRootRootKey === '/' ? '/' : `${notesRootRootKey}/`;

  if (
    notesRootRootKey &&
    selectedPathKey !== notesRootRootKey &&
    selectedPathKey.startsWith(notesRootPrefixKey)
  ) {
    const notesRootRelativePath = normalizedSelectedPath.slice(notesRootRootKey === '/' ? 1 : normalizedNotesRootRoot.length + 1);
    if (hasInternalNotePathSegment(notesRootRelativePath)) {
      throw new Error('Path must not be inside an internal notes folder.');
    }

    return {
      absolutePath: selectedPath,
      relativePath: notesRootRelativePath,
    };
  }

  return {
    absolutePath: selectedPath,
    relativePath: null,
  };
}

function getDraftSavePathComparisonKey(path: string): string {
  return /^[A-Za-z]:(?:\/|$)/.test(path) || path.startsWith('//')
    ? path.toLowerCase()
    : path;
}
