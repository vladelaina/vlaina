import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { createCloudNoteLogicalPath, parseCloudNoteLogicalPath } from '@/stores/cloudRepos';
import { openStoredNotePath } from '@/stores/notes/openNotePath';
import { useGithubReposStore } from '@/stores/useGithubReposStore';
import { useNotesStore } from '@/stores/useNotesStore';

function isCloudPathWithinFolder(path: string, folderPath: string): boolean {
  return path === folderPath || path.startsWith(`${folderPath}/`);
}

export async function removeCloudSessionPaths(
  repositoryId: number,
  branch: string,
  relativePath: string,
  kind: 'file' | 'folder'
): Promise<void> {
  const logicalTarget = createCloudNoteLogicalPath(repositoryId, branch, relativePath);
  const { openTabs, currentNote, openNote, openNoteByAbsolutePath } = useNotesStore.getState();

  const updatedTabs = openTabs.filter((tab) => {
    if (!tab.path.startsWith('cloud://')) return true;
    if (kind === 'file') return tab.path !== logicalTarget;
    return !(tab.path === logicalTarget || tab.path.startsWith(`${logicalTarget}/`));
  });

  const removedCurrent =
    currentNote?.path &&
    (kind === 'file'
      ? currentNote.path === logicalTarget
      : currentNote.path === logicalTarget || currentNote.path.startsWith(`${logicalTarget}/`));

  useNotesStore.setState({
    openTabs: updatedTabs,
    currentNote: removedCurrent ? null : currentNote,
    isDirty: removedCurrent ? false : useNotesStore.getState().isDirty,
  });

  if (removedCurrent && updatedTabs.length > 0) {
    await openStoredNotePath(updatedTabs[updatedTabs.length - 1].path, {
      openNote,
      openNoteByAbsolutePath,
    });
  }
}

export function remapCloudSessionPaths(
  repositoryId: number,
  branch: string,
  fromRelativePath: string,
  toRelativePath: string,
  kind: 'file' | 'folder'
): void {
  const fromLogicalPath = createCloudNoteLogicalPath(repositoryId, branch, fromRelativePath);
  const fileCache = useGithubReposStore.getState().fileCache;

  useNotesStore.setState((state) => {
    const displayNames = new Map(state.displayNames);
    const openTabs = state.openTabs.map((tab) => {
      const parsed = parseCloudNoteLogicalPath(tab.path);
      if (!parsed || parsed.repositoryId !== repositoryId || parsed.branch !== branch) {
        return tab;
      }

      const isAffected =
        kind === 'file'
          ? parsed.relativePath === fromRelativePath
          : isCloudPathWithinFolder(parsed.relativePath, fromRelativePath);
      if (!isAffected) return tab;

      const nextRelativePath =
        kind === 'file'
          ? toRelativePath
          : `${toRelativePath}${parsed.relativePath.slice(fromRelativePath.length)}`;
      const nextLogicalPath = createCloudNoteLogicalPath(repositoryId, branch, nextRelativePath);
      const nextName = getNoteTitleFromPath(nextRelativePath);
      const previousDisplayName = displayNames.get(tab.path);

      displayNames.delete(tab.path);
      displayNames.set(nextLogicalPath, previousDisplayName || nextName);

      return {
        ...tab,
        path: nextLogicalPath,
        name: nextName,
      };
    });

    let currentNote = state.currentNote;
    if (currentNote) {
      const parsed = parseCloudNoteLogicalPath(currentNote.path);
      if (parsed && parsed.repositoryId === repositoryId && parsed.branch === branch) {
        const isAffected =
          kind === 'file'
            ? parsed.relativePath === fromRelativePath
            : isCloudPathWithinFolder(parsed.relativePath, fromRelativePath);

        if (isAffected) {
          const nextRelativePath =
            kind === 'file'
              ? toRelativePath
              : `${toRelativePath}${parsed.relativePath.slice(fromRelativePath.length)}`;
          const nextLogicalPath = createCloudNoteLogicalPath(repositoryId, branch, nextRelativePath);
          const cached = fileCache.get(nextLogicalPath);

          currentNote = {
            ...currentNote,
            path: nextLogicalPath,
            remotePath: nextRelativePath,
            remoteSha: cached?.sha ?? currentNote.remoteSha ?? null,
            content: cached?.content ?? currentNote.content,
          };
        }
      }
    }

    if (kind === 'file') {
      const cached = fileCache.get(createCloudNoteLogicalPath(repositoryId, branch, toRelativePath));
      if (cached) {
        displayNames.set(cached.logicalPath, getNoteTitleFromPath(toRelativePath));
      }
    }

    return { openTabs, currentNote, displayNames };
  });

  const nextCurrentNote = useNotesStore.getState().currentNote;
  if (!nextCurrentNote) {
    return;
  }

  if (kind === 'file' && nextCurrentNote.path === fromLogicalPath) {
    const nextLogicalPath = createCloudNoteLogicalPath(repositoryId, branch, toRelativePath);
    const cached = useGithubReposStore.getState().fileCache.get(nextLogicalPath);
    if (cached) {
      useNotesStore.setState((state) => ({
        currentNote: state.currentNote
          ? {
              ...state.currentNote,
              path: nextLogicalPath,
              remotePath: toRelativePath,
              remoteSha: cached.sha,
              content: cached.content,
            }
          : null,
      }));
    }
  }
}
