import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { useNotesStore } from '@/stores/useNotesStore';
import { setCachedNoteContent } from './document/noteContentCache';
import { setNoteTabDirtyState } from './document/noteTabState';
import { compareLineBreakText, logLineBreakDebug, summarizeLineBreakText } from './lineBreakDebugLog';
export {
  flushCurrentPendingEditorMarkdown,
  setPendingEditorMarkdownFlusher,
} from './pendingEditorMarkdownFlusher';

export function flushPendingEditorMarkdown(notePath: string | null | undefined, markdown: string | null): boolean {
  if (!notePath || markdown === null) {
    logLineBreakDebug('pending:skip-missing-input', {
      notePath: notePath ?? null,
      markdown: summarizeLineBreakText(markdown),
    });
    return false;
  }

  const state = useNotesStore.getState();
  const isKnownWorkspaceNote =
    state.currentNote?.path === notePath ||
    state.openTabs.some((tab) => tab.path === notePath) ||
    state.noteContentsCache.has(notePath);
  if (!isKnownWorkspaceNote) {
    logLineBreakDebug('pending:skip-unknown-note', {
      notePath,
      currentNotePath: state.currentNote?.path ?? null,
      openTabPaths: state.openTabs.map((tab) => tab.path),
      cacheHasPath: state.noteContentsCache.has(notePath),
      markdown: summarizeLineBreakText(markdown),
    });
    return false;
  }

  const currentContent =
    state.currentNote?.path === notePath
      ? state.currentNote.content
      : state.noteContentsCache.get(notePath)?.content;

  if (currentContent === markdown) {
    logLineBreakDebug('pending:skip-unchanged', {
      notePath,
      current: summarizeLineBreakText(currentContent),
      markdown: summarizeLineBreakText(markdown),
    });
    return false;
  }

  const modifiedAt = state.noteContentsCache.get(notePath)?.modifiedAt ?? null;
  logLineBreakDebug('pending:apply', {
    notePath,
    currentNotePath: state.currentNote?.path ?? null,
    isCurrentNote: state.currentNote?.path === notePath,
    openTabPaths: state.openTabs.map((tab) => tab.path),
    cacheHasPath: state.noteContentsCache.has(notePath),
    current: summarizeLineBreakText(currentContent),
    markdown: summarizeLineBreakText(markdown),
    diff: compareLineBreakText(currentContent, markdown),
  });
  useNotesStore.setState((latest) => {
    const isCurrentNote = latest.currentNote?.path === notePath;
    const nextCurrentNote = isCurrentNote && latest.currentNote
      ? { path: latest.currentNote.path, content: markdown }
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
        markdown,
        modifiedAt,
      ),
    };
  });

  return true;
}
