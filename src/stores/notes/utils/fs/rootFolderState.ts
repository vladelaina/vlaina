import type { NotesStore } from '../../types';
import { sortNestedFileTree } from '../../fileTreeSorting';

export function buildSortedRootFolder(
  rootFolder: NotesStore['rootFolder'],
  children: NonNullable<NotesStore['rootFolder']>['children'],
  fileTreeSortMode: NotesStore['fileTreeSortMode'],
  noteMetadata: NotesStore['noteMetadata']
) {
  if (!rootFolder) {
    return null;
  }

  return {
    ...rootFolder,
    children: sortNestedFileTree(children, {
      mode: fileTreeSortMode,
      metadata: noteMetadata,
    }),
  };
}
