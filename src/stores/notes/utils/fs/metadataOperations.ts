import { saveNoteMetadata } from '../../storage';
import { NotesStore } from '../../types';

export function updateFavoritesOnRename(
  favorites: string[],
  oldPath: string,
  newPath: string
): { updated: string[]; changed: boolean } {
  let changed = false;
  const updated = favorites.map(p => {
    if (p === oldPath) {
      changed = true;
      return newPath;
    }
    if (p.startsWith(oldPath + '/')) {
      changed = true;
      return p.replace(oldPath, newPath);
    }
    return p;
  });
  return { updated, changed };
}

export function updateFavoritesOnDelete(
  favorites: string[],
  deletedPath: string
): { updated: string[]; changed: boolean } {
  const initialLen = favorites.length;
  const updated = favorites.filter(p => p !== deletedPath && !p.startsWith(deletedPath + '/'));
  return { updated, changed: updated.length !== initialLen };
}

export function updateFavoritesOnMove(
    favorites: string[],
    sourcePath: string,
    newPath: string
): { updated: string[]; changed: boolean } {
    let changed = false;
    const updated = favorites.map(p => {
        if (p === sourcePath) {
            changed = true;
            return newPath;
        }
        if (p.startsWith(sourcePath + '/')) {
            changed = true;
            return p.replace(sourcePath, newPath);
        }
        return p;
    });
    return { updated, changed };
}

export async function syncMetadataOnRename(
    notesPath: string,
    metadata: NotesStore['noteMetadata'],
    oldPath: string,
    newPath: string
) {
    if (!metadata?.notes[oldPath]) return metadata;

    const entry = metadata.notes[oldPath];
    const { [oldPath]: _, ...rest } = metadata.notes;
    const updated = {
        ...metadata,
        notes: { ...rest, [newPath]: entry }
    };
    
    await saveNoteMetadata(notesPath, updated);
    return updated;
}
