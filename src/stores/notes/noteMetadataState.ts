import { setNoteEntry } from './storage';
import { isVaultNotePath } from './notePathState';
import type { MetadataFile, NoteMetadataEntry } from './types';

const EMPTY_METADATA_VERSION = 1;

export function createEmptyMetadataFile(): MetadataFile {
  return {
    version: EMPTY_METADATA_VERSION,
    notes: {},
  };
}

export function ensureMetadataFile(metadata: MetadataFile | null): MetadataFile {
  return metadata ?? createEmptyMetadataFile();
}

export function getNoteMetadataEntry(
  metadata: MetadataFile | null,
  path: string | null | undefined,
): NoteMetadataEntry | undefined {
  if (!metadata || !path) {
    return undefined;
  }

  return metadata.notes[path];
}

export function shouldPersistNoteMetadata(path: string, notesPath: string): boolean {
  return Boolean(notesPath && isVaultNotePath(path));
}

export function persistNoteMetadataIfNeeded(
  notesPath: string,
  path: string,
  metadata: MetadataFile,
): void {
  if (!shouldPersistNoteMetadata(path, notesPath)) {
    return;
  }

  void metadata;
}

export function applyNoteMetadataUpdates(
  metadata: MetadataFile | null,
  path: string,
  updates: Partial<NoteMetadataEntry>,
): MetadataFile {
  return setNoteEntry(ensureMetadataFile(metadata), path, updates);
}

export function moveNoteMetadataEntry(
  metadata: MetadataFile | null,
  sourcePath: string,
  targetPath: string,
  fallbackUpdates: Partial<NoteMetadataEntry>,
): MetadataFile {
  const currentMetadata = ensureMetadataFile(metadata);
  const sourceEntry = currentMetadata.notes[sourcePath];
  const { [sourcePath]: _removedSourceEntry, ...remainingNotes } = currentMetadata.notes;

  return setNoteEntry(
    {
      ...currentMetadata,
      notes: remainingNotes,
    },
    targetPath,
    {
      ...sourceEntry,
      ...fallbackUpdates,
    },
  );
}
