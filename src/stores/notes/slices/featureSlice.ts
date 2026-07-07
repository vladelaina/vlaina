import { StateCreator } from 'zustand';
import {
  pruneCachedNoteContents,
} from '../document/noteContentCache';
import {
  findStarredEntryByPath,
  loadStarredForNotesRoot,
  removeStarredEntryById,
  toggleStarredEntry,
} from '../starred';
import {
  loadGlobalNoteIconSize,
  loadNoteMetadata,
  loadRecentNotes,
  persistGlobalNoteIconSize,
} from '../storage';
import { MetadataFile, NoteCoverMetadata, NotesStore } from '../types';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { isSafeStoredNotePath } from './featureSliceContentUtils';
import { createFeatureMetadataActions } from './featureSliceMetadataActions';
import { getAllTagsFromCache, getBacklinksFromCache } from './featureSliceQueries';
import { createNoteContentScanActions } from './featureSliceScanActions';

const ICON_SYMBOL_SCHEME_PATTERN = /^icon:/i;

export interface FeatureSlice {
  recentNotes: NotesStore['recentNotes'];
  noteContentsCache: NotesStore['noteContentsCache'];
  noteContentsCacheRevision: NotesStore['noteContentsCacheRevision'];
  starredEntries: NotesStore['starredEntries'];
  starredNotes: NotesStore['starredNotes'];
  starredFolders: NotesStore['starredFolders'];
  starredLoaded: NotesStore['starredLoaded'];
  pendingStarredNavigation: NotesStore['pendingStarredNavigation'];
  noteMetadata: MetadataFile | null;
  noteIconSize: number;

  loadStarred: (notesRootPath: string) => Promise<void>;
  loadMetadata: (notesRootPath: string) => Promise<void>;
  scanAllNotes: (options?: { signal?: AbortSignal }) => Promise<void>;
  cancelNoteContentScan: () => void;
  pruneNoteContentsCacheToOpenNotes: () => void;
  getBacklinks: (notePath: string) => { path: string; name: string; context: string }[];
  getAllTags: () => { tag: string; count: number }[];
  toggleStarred: (path: string) => void;
  toggleFolderStarred: (path: string) => void;
  removeStarredEntry: (id: string) => void;
  isStarred: (path: string) => boolean;
  isFolderStarred: (path: string) => boolean;
  setPendingStarredNavigation: (navigation: NotesStore['pendingStarredNavigation']) => void;
  getNoteIcon: (path: string) => string | undefined;
  setNoteIcon: (path: string, emoji: string | null) => void;
  updateAllIconColors: (newColor: string) => void;
  updateAllEmojiSkinTones: (newTone: number) => Promise<void>;
  getNoteCover: (path: string) => NoteCoverMetadata | undefined;
  setNoteCover: (path: string, cover: NoteCoverMetadata | null) => void;
  getNoteIconSize: (path: string) => number | undefined;
  setNoteIconSize: (path: string, size: number) => void;
  setGlobalIconSize: (size: number) => void;
}

export const createFeatureSlice: StateCreator<NotesStore, [], [], FeatureSlice> = (set, get) => {
  const isActiveNotesRootRequest = (notesRootPath: string) => get().notesPath === notesRootPath;
  const noteContentScanActions = createNoteContentScanActions({
    get,
    isActiveNotesRootRequest,
    set,
  });
  const metadataActions = createFeatureMetadataActions({
    get,
    isActiveNotesRootRequest,
    set,
  });

  return {
    recentNotes: loadRecentNotes(),
    noteContentsCache: new Map(),
    noteContentsCacheRevision: 0,
    starredEntries: [],
    starredNotes: [],
    starredFolders: [],
    starredLoaded: false,
    pendingStarredNavigation: null,
    noteMetadata: null,
    noteIconSize: loadGlobalNoteIconSize(),

    loadStarred: async (notesRootPath: string) => {
      await loadStarredForNotesRoot(set, get, notesRootPath);
    },

    loadMetadata: async (notesRootPath: string) => {
      const metadata = await loadNoteMetadata(notesRootPath);
      if (!isActiveNotesRootRequest(notesRootPath)) {
        return;
      }
      set({
        noteMetadata: metadata,
      });
    },

    scanAllNotes: noteContentScanActions.scanAllNotes,

    cancelNoteContentScan: () => {
      noteContentScanActions.cancelNoteContentScan();
    },

    pruneNoteContentsCacheToOpenNotes: () => {
      const { currentNote, openTabs, draftNotes, noteContentsCache } = get();
      const keepPaths = new Set(openTabs.map((tab) => tab.path));
      if (currentNote) {
        keepPaths.add(currentNote.path);
      }
      Object.keys(draftNotes).forEach((path) => keepPaths.add(path));

      const nextCache = pruneCachedNoteContents(
        noteContentsCache,
        (path) => !keepPaths.has(path),
      );
      if (nextCache !== noteContentsCache) {
        set({ noteContentsCache: nextCache });
      }
    },

    getBacklinks: (notePath: string) => {
      return getBacklinksFromCache(get().noteContentsCache, notePath);
    },

    getAllTags: () => {
      return getAllTagsFromCache(get().noteContentsCache);
    },

    toggleStarred: (path: string) => {
      toggleStarredEntry(set, get, 'note', path);
    },

    toggleFolderStarred: (path: string) => {
      toggleStarredEntry(set, get, 'folder', path);
    },

    removeStarredEntry: (id: string) => {
      removeStarredEntryById(set, get, id);
    },

    isStarred: (path: string) => {
      const { notesPath, starredEntries } = get();
      return Boolean(findStarredEntryByPath(starredEntries, 'note', path, notesPath));
    },

    isFolderStarred: (path: string) => {
      const { notesPath, starredEntries } = get();
      return Boolean(findStarredEntryByPath(starredEntries, 'folder', path, notesPath));
    },

    setPendingStarredNavigation: (pendingStarredNavigation) => set({ pendingStarredNavigation }),

    getNoteIcon: (path: string) => {
      const { noteMetadata } = get();
      if (!noteMetadata) return undefined;
      return noteMetadata.notes[path]?.icon;
    },

    setNoteIcon: (path: string, emoji: string | null) => {
      void Promise.resolve(metadataActions.updateSingleNoteMetadata(path, { icon: emoji ?? undefined }))
        .catch(() => undefined);
    },

    updateAllIconColors: (newColor: string) => {
      const { noteMetadata } = get();
      if (!noteMetadata) return;

      const updates = Object.entries(noteMetadata.notes)
        .map(([path, entry]) => {
          if (hasInternalNotePathSegment(path)) {
            return null;
          }
          if (!isSafeStoredNotePath(path)) {
            return null;
          }

          if (!entry.icon || !ICON_SYMBOL_SCHEME_PATTERN.test(entry.icon)) {
            return null;
          }

          const parts = entry.icon.split(':');
          const iconName = parts[1];
          const iconScheme = entry.icon.slice(0, 'icon:'.length);
          const nextIcon = iconName ? `${iconScheme}${iconName}:${newColor}` : entry.icon;
          if (!iconName || nextIcon === entry.icon) {
            return null;
          }

          return {
            path,
            updates: { icon: nextIcon },
          };
        })
        .filter((entry): entry is { path: string; updates: { icon: string } } => entry !== null);

      void Promise.resolve(metadataActions.updateManyNoteMetadata(updates)).catch(() => undefined);
    },

    updateAllEmojiSkinTones: async (newTone: number) => {
      const { noteMetadata } = get();
      if (!noteMetadata) return;
      const { EMOJI_MAP } = await import('@/components/common/UniversalIconPicker/constants');

      const updates = Object.entries(noteMetadata.notes)
        .map(([path, entry]) => {
          if (hasInternalNotePathSegment(path)) {
            return null;
          }
          if (!isSafeStoredNotePath(path)) {
            return null;
          }

          const icon = entry.icon;
          if (!icon || ICON_SYMBOL_SCHEME_PATTERN.test(icon)) {
            return null;
          }

          const item = EMOJI_MAP.get(icon);
          if (!item || !item.skins || item.skins.length <= newTone) {
            return null;
          }

          const nextIcon =
            newTone === 0 ? item.native : (item.skins[newTone]?.native || item.native);
          if (nextIcon === icon) {
            return null;
          }

          return {
            path,
            updates: { icon: nextIcon },
          };
        })
        .filter((entry): entry is { path: string; updates: { icon: string } } => entry !== null);

      await metadataActions.updateManyNoteMetadata(updates);
    },

    getNoteCover: (path: string) => {
      const { noteMetadata } = get();
      return noteMetadata?.notes[path]?.cover;
    },

    setNoteCover: (path: string, cover: NoteCoverMetadata | null) => {
      void Promise.resolve(metadataActions.updateSingleNoteMetadata(path, {
        cover: cover?.assetPath
          ? {
            assetPath: cover.assetPath,
            positionX: cover.positionX ?? 50,
            positionY: cover.positionY ?? 50,
            height: cover.height,
            scale: cover.scale ?? 1,
          }
          : undefined,
      })).catch(() => undefined);
    },

    getNoteIconSize: (path: string) => {
      const state = get();
      return state.noteMetadata?.notes[path]?.iconSize ?? state.noteIconSize;
    },

    setGlobalIconSize: (size: number) => {
      const normalized = persistGlobalNoteIconSize(size);
      set({ noteIconSize: normalized });
    },

    setNoteIconSize: (path: string, size: number) => {
      void metadataActions.updateSingleNoteMetadata(path, { iconSize: size });
    },
  };
};
