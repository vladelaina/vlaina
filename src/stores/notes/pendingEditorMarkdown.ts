import { normalizeEditorRuntimeMarkdownArtifacts } from '@/lib/notes/markdown/markdownSerializationUtils';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { useNotesStore } from '@/stores/useNotesStore';
import { setCachedNoteContent } from './document/noteContentCache';
import { setNoteTabDirtyState } from './document/noteTabState';

export {
  flushCurrentPendingEditorMarkdown,
  setPendingEditorMarkdownFlusher,
} from './pendingEditorMarkdownFlusher';

export function flushPendingEditorMarkdown(notePath: string | null | undefined, markdown: string | null): boolean {
  if (!notePath || markdown === null) {
    return false;
  }

  const normalizedMarkdown = normalizeEditorRuntimeMarkdownArtifacts(markdown);
  const state = useNotesStore.getState();
  const isKnownWorkspaceNote =
    state.currentNote?.path === notePath ||
    state.openTabs.some((tab) => tab.path === notePath) ||
    state.noteContentsCache.has(notePath);
  if (!isKnownWorkspaceNote) {
    return false;
  }

  const currentContent =
    state.currentNote?.path === notePath
      ? state.currentNote.content
      : state.noteContentsCache.get(notePath)?.content;

  if (currentContent === normalizedMarkdown) {
    return false;
  }

  const modifiedAt = state.noteContentsCache.get(notePath)?.modifiedAt ?? null;
  useNotesStore.setState((latest) => {
    const isCurrentNote = latest.currentNote?.path === notePath;
    const nextCurrentNote = isCurrentNote && latest.currentNote
      ? { path: latest.currentNote.path, content: normalizedMarkdown }
      : latest.currentNote;

    return {
      currentNote: nextCurrentNote,
      currentNoteRevision: isCurrentNote
        ? latest.currentNoteRevision + 1
        : latest.currentNoteRevision,
      isDirty: isCurrentNote ? true : latest.isDirty,
      openTabs: latest.openTabs.some((tab) => tab.path === notePath)
        ? setNoteTabDirtyState(latest.openTabs, notePath, true)
        : [
            ...latest.openTabs,
            { path: notePath, name: getNoteTitleFromPath(notePath), isDirty: true },
          ],
      noteContentsCache: setCachedNoteContent(
        latest.noteContentsCache,
        notePath,
        normalizedMarkdown,
        modifiedAt,
      ),
    };
  });

  return true;
}
