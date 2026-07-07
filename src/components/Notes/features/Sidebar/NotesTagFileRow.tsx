import { memo, useEffect, useMemo, useState } from 'react';
import { stripMarkdownExtension } from '@/lib/notes/displayName';
import { useDisplayIcon, useDisplayName } from '@/hooks/useTitleSync';
import { useNotesStore } from '@/stores/useNotesStore';
import { resolveEffectiveNotesRootPath } from '@/stores/notes/effectiveNotesRootPath';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';
import { NotesSidebarRow } from './NotesSidebarRow';
import { SidebarNoteFileIcon } from './SidebarNoteFileIcon';
import type { NotesSidebarTagPath } from './notesSidebarTags';
import {
  getCachedTagNoteIcon,
  readTagNoteIcon,
  setTagNoteIconCacheEntry,
} from './tagNoteIconMetadata';

interface NotesTagFileRowProps {
  target: NotesSidebarTagPath;
  currentNotePath?: string | null;
  getDisplayName: (path: string) => string;
  onOpenNote: (target: NotesSidebarTagPath) => void;
}

export const NotesTagFileRow = memo(function NotesTagFileRow({
  target,
  currentNotePath,
  getDisplayName,
  onOpenNote,
}: NotesTagFileRowProps) {
  const path = target.path;
  const storeIcon = useDisplayIcon(path);
  const displayName = useDisplayName(path);
  const notesPath = useNotesStore((state) => state.notesPath);
  const notesRootPath = resolveEffectiveNotesRootPath({ notesPath, currentNotePath: path });
  const cacheKey = useMemo(() => `${notesRootPath}\u001f${path}`, [notesRootPath, path]);
  const [fallbackIcon, setFallbackIcon] = useState<string | undefined>(() =>
    getCachedTagNoteIcon(cacheKey)
  );
  const noteIcon = storeIcon || fallbackIcon;

  useEffect(() => {
    if (storeIcon) {
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    void readTagNoteIcon(path, notesRootPath || null, cacheKey, abortController.signal)
      .then((entry) => {
        if (cancelled || abortController.signal.aborted) {
          return;
        }

        setTagNoteIconCacheEntry(cacheKey, entry);
        setFallbackIcon(entry.icon ?? undefined);
      })
      .catch((error) => {
        if (
          cancelled ||
          abortController.signal.aborted ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }

        setTagNoteIconCacheEntry(cacheKey, { modifiedAt: null, size: null, icon: null });
        setFallbackIcon(undefined);
      });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [cacheKey, path, storeIcon, notesRootPath]);

  return (
    <NotesSidebarRow
      data-notes-sidebar-tag-file-row="true"
      data-notes-sidebar-tag-file-path={path}
      depth={2}
      rowClassName="h-auto min-h-[var(--vlaina-size-36px)] items-start py-1.5"
      leadingClassName="self-start pt-1"
      contentClassName="min-w-0 overflow-hidden pr-2"
      leading={
        <SidebarNoteFileIcon icon={noteIcon} notePath={path} size={NOTES_SIDEBAR_ICON_SIZE} />
      }
      isActive={currentNotePath === path}
      main={
        <span className="block min-w-0 max-w-full whitespace-normal break-words text-[var(--vlaina-font-base)] leading-5 text-[var(--vlaina-sidebar-notes-text)] [overflow-wrap:anywhere]">
          {displayName || getDisplayName(path) || stripMarkdownExtension(path.split('/').pop() ?? '') || path}
        </span>
      }
      onClick={() => onOpenNote(target)}
    />
  );
}, areNotesTagFileRowPropsEqual);

function areNotesTagFileRowPropsEqual(
  previous: NotesTagFileRowProps,
  next: NotesTagFileRowProps,
) {
  const wasActive = previous.currentNotePath === previous.target.path;
  const isActive = next.currentNotePath === next.target.path;
  return (
    previous.target === next.target &&
    previous.getDisplayName === next.getDisplayName &&
    previous.onOpenNote === next.onOpenNote &&
    wasActive === isActive
  );
}
