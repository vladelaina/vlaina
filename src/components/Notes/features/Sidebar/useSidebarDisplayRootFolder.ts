import { useMemo } from 'react';
import { isDraftNoteEmpty, isDraftNotePath, resolveDraftNoteTitle } from '@/stores/notes/draftNote';
import type { FolderNode } from '@/stores/useNotesStore';

interface UseSidebarDisplayRootFolderArgs {
  rootFolder: FolderNode | null;
  currentNotePath?: string | null;
  draftNotes: Record<string, { name: string; parentPath: string | null }>;
  currentDraftPreviewTitle: string;
  currentDraftContent: string;
}

export function useSidebarDisplayRootFolder({
  rootFolder,
  currentNotePath,
  draftNotes,
  currentDraftPreviewTitle,
  currentDraftContent,
}: UseSidebarDisplayRootFolderArgs) {
  return useMemo(() => {
    if (!currentNotePath || !isDraftNotePath(currentNotePath)) {
      return rootFolder;
    }

    const draftEntry = draftNotes[currentNotePath];
    if (!draftEntry) {
      return rootFolder;
    }

    if (
      rootFolder &&
      rootFolder.children.length === 0 &&
      !draftEntry.name.trim() &&
      !currentDraftPreviewTitle &&
      isDraftNoteEmpty(currentDraftContent)
    ) {
      return rootFolder;
    }

    const draftNode = {
      id: currentNotePath,
      name: currentDraftPreviewTitle || resolveDraftNoteTitle(draftEntry.name),
      path: currentNotePath,
      isFolder: false as const,
    };
    const draftParentPath = draftEntry.parentPath ?? '';

    if (!rootFolder) {
      return rootFolder;
    }

    if (rootFolder.children.some((node) => node.path === currentNotePath)) {
      return rootFolder;
    }

    if (draftParentPath !== '') {
      let didInsert = false;
      const injectDraftIntoFolder = (folder: FolderNode): FolderNode => {
        if (folder.path === draftParentPath) {
          didInsert = true;
          return {
            ...folder,
            expanded: true,
            children: folder.children.some((node) => node.path === currentNotePath)
              ? folder.children
              : [draftNode, ...folder.children],
          };
        }

        const nextChildren = folder.children.map((node) => (
          node.isFolder ? injectDraftIntoFolder(node) : node
        ));

        return didInsert ? { ...folder, children: nextChildren } : folder;
      };

      const nextRootFolder = injectDraftIntoFolder(rootFolder);
      return didInsert ? nextRootFolder : rootFolder;
    }

    return {
      ...rootFolder,
      children: [draftNode, ...rootFolder.children],
    };
  }, [currentDraftContent, currentDraftPreviewTitle, currentNotePath, draftNotes, rootFolder]);
}
