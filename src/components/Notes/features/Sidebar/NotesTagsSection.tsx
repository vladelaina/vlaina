import { useEffect, useMemo, useState } from 'react';
import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import { stripMarkdownExtension } from '@/lib/notes/displayName';
import { NotesSidebarRow } from './NotesSidebarRow';
import type { NotesSidebarTagEntry, NotesSidebarTagPath } from './notesSidebarTags';
import { CollapseTriangleAffordance } from '../common/collapseTrianglePrimitive';
import { useI18n } from '@/lib/i18n';
import { Icon } from '@/components/ui/icons';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';
import { useNotesStore } from '@/stores/useNotesStore';
import { readNoteMetadataFromMarkdown } from '@/stores/notes/frontmatter';
import { resolveEffectiveVaultPath } from '@/stores/notes/effectiveVaultPath';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import { resolveVaultRelativeFullPath } from '@/stores/notes/utils/fs/vaultPathContainment';
import { themeIconTokens } from '@/styles/themeTokens';

const MAX_TAG_NOTE_ICON_CACHE_ENTRIES = 300;
const MAX_TAG_NOTE_ICON_METADATA_BYTES = 512 * 1024;
export const MAX_CONCURRENT_TAG_NOTE_ICON_METADATA_READS = 4;

interface TagNoteIconCacheEntry {
  modifiedAt: number | null;
  size: number | null;
  icon: string | null;
}

const tagNoteIconCache = new Map<string, TagNoteIconCacheEntry>();
const pendingTagNoteIconMetadataReads: ScheduledTagNoteIconRead[] = [];
let activeTagNoteIconMetadataReads = 0;

interface ScheduledTagNoteIconRead {
  run: () => Promise<void>;
}

function createAbortError() {
  const error = new Error('Tag note icon metadata read aborted');
  error.name = 'AbortError';
  return error;
}

function drainTagNoteIconMetadataReadQueue() {
  while (
    activeTagNoteIconMetadataReads < MAX_CONCURRENT_TAG_NOTE_ICON_METADATA_READS &&
    pendingTagNoteIconMetadataReads.length > 0
  ) {
    const scheduled = pendingTagNoteIconMetadataReads.shift();
    if (!scheduled) {
      return;
    }

    activeTagNoteIconMetadataReads += 1;
    void scheduled.run().finally(() => {
      activeTagNoteIconMetadataReads -= 1;
      drainTagNoteIconMetadataReadQueue();
    });
  }
}

function scheduleTagNoteIconMetadataRead(
  task: () => Promise<TagNoteIconCacheEntry>,
  signal?: AbortSignal,
): Promise<TagNoteIconCacheEntry> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    let scheduled: ScheduledTagNoteIconRead | null = null;
    const abortPendingRead = () => {
      if (!scheduled) {
        return;
      }

      const pendingIndex = pendingTagNoteIconMetadataReads.indexOf(scheduled);
      if (pendingIndex === -1) {
        return;
      }

      pendingTagNoteIconMetadataReads.splice(pendingIndex, 1);
      reject(createAbortError());
    };

    scheduled = {
      run: async () => {
        signal?.removeEventListener('abort', abortPendingRead);
        if (signal?.aborted) {
          reject(createAbortError());
          return;
        }

        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      },
    };

    signal?.addEventListener('abort', abortPendingRead, { once: true });
    pendingTagNoteIconMetadataReads.push(scheduled);
    drainTagNoteIconMetadataReadQueue();
  });
}

function setTagNoteIconCacheEntry(cacheKey: string, entry: TagNoteIconCacheEntry) {
  tagNoteIconCache.delete(cacheKey);
  tagNoteIconCache.set(cacheKey, entry);

  while (tagNoteIconCache.size > MAX_TAG_NOTE_ICON_CACHE_ENTRIES) {
    const oldestKey = tagNoteIconCache.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    tagNoteIconCache.delete(oldestKey);
  }
}

function touchTagNoteIconCacheEntry(cacheKey: string, entry: TagNoteIconCacheEntry) {
  tagNoteIconCache.delete(cacheKey);
  tagNoteIconCache.set(cacheKey, entry);
}

function getFreshTagNoteIconCacheEntry(
  cacheKey: string,
  modifiedAt: number | null,
  size: number | null,
): TagNoteIconCacheEntry | null {
  const cached = tagNoteIconCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  const canValidateCache = modifiedAt !== null;
  if (!canValidateCache || cached.modifiedAt !== modifiedAt || cached.size !== size) {
    return null;
  }

  touchTagNoteIconCacheEntry(cacheKey, cached);
  return cached;
}

async function readTagNoteIconFromStorage(path: string, vaultPath: string | null, cacheKey: string): Promise<TagNoteIconCacheEntry> {
  if (
    hasInternalNotePathSegment(path) ||
    (vaultPath && hasInternalNotePathSegment(vaultPath))
  ) {
    return { modifiedAt: null, size: null, icon: null };
  }

  const fullPath = isAbsolutePath(path)
    ? path
    : vaultPath
      ? await resolveVaultRelativeFullPath(vaultPath, path)
          .then((result) => result.fullPath)
          .catch(() => null)
      : null;
  if (!fullPath) {
    return { modifiedAt: null, size: null, icon: null };
  }

  const storage = getStorageAdapter();
  const fileInfo = await storage.stat(fullPath).catch(() => null);
  const modifiedAt = fileInfo?.modifiedAt ?? null;
  const size = fileInfo?.size ?? null;
  if (
    fileInfo?.isDirectory === true ||
    fileInfo?.isFile === false ||
    typeof size !== 'number' ||
    size > MAX_TAG_NOTE_ICON_METADATA_BYTES
  ) {
    return { modifiedAt, size, icon: null };
  }

  const freshCached = getFreshTagNoteIconCacheEntry(cacheKey, modifiedAt, size);
  if (freshCached) {
    return freshCached;
  }

  const content = await storage.readFile(fullPath, MAX_TAG_NOTE_ICON_METADATA_BYTES);
  if (content.length > MAX_TAG_NOTE_ICON_METADATA_BYTES) {
    return { modifiedAt, size, icon: null };
  }

  return {
    modifiedAt,
    size,
    icon: readNoteMetadataFromMarkdown(content).icon ?? null,
  };
}

async function readTagNoteIcon(
  path: string,
  vaultPath: string | null,
  cacheKey: string,
  signal?: AbortSignal,
): Promise<TagNoteIconCacheEntry> {
  return scheduleTagNoteIconMetadataRead(
    () => readTagNoteIconFromStorage(path, vaultPath, cacheKey),
    signal,
  );
}

interface NotesTagsSectionProps {
  tags: NotesSidebarTagEntry[];
  currentNotePath?: string | null;
  getDisplayName: (path: string) => string;
  onOpenNote: (target: NotesSidebarTagPath) => void;
}

export function NotesTagsSection({
  tags,
  currentNotePath,
  getDisplayName,
  onOpenNote,
}: NotesTagsSectionProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [expandedTags, setExpandedTags] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (tags.length > 0) {
      setExpanded(true);
    }
  }, [tags.length]);

  useEffect(() => {
    setExpandedTags((current) => {
      const nextTags = new Set(tags.map((entry) => entry.tag));
      const nextExpanded = new Set<string>();
      current.forEach((tag) => {
        if (nextTags.has(tag)) {
          nextExpanded.add(tag);
        }
      });
      return nextExpanded;
    });
  }, [tags]);

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0 w-full overflow-hidden rounded-md" data-notes-sidebar-tags-root="true">
      <NotesSidebarRow
        data-notes-sidebar-tags-header="true"
        leading={
          <span className="relative flex size-[var(--vlaina-size-20px)] items-center justify-center">
            <span className="text-[var(--vlaina-font-base)] font-semibold leading-none text-[var(--vlaina-sidebar-notes-folder-icon)] transition-none group-hover/sidebar-row:opacity-[var(--vlaina-opacity-0)] group-focus-within/sidebar-row:opacity-[var(--vlaina-opacity-0)]">
              #
            </span>
            <CollapseTriangleAffordance
              collapsed={!expanded}
              visibility="always"
              size={themeIconTokens.sizeSm}
              className="absolute inset-0 opacity-[var(--vlaina-opacity-0)] transition-none group-hover/sidebar-row:opacity-[var(--vlaina-opacity-100)] group-focus-within/sidebar-row:opacity-[var(--vlaina-opacity-100)]"
              iconClassName="text-[var(--vlaina-sidebar-notes-file-icon)]"
            />
          </span>
        }
        main={
          <span className="block min-w-0 max-w-full truncate text-[var(--vlaina-font-base)] text-[var(--vlaina-sidebar-notes-text)]">
            {t('notes.tags')}
          </span>
        }
        onClick={() => setExpanded((value) => !value)}
      />
      {expanded ? (
        <div>
          <div aria-hidden="true" className="h-2" />
          {tags.map((entry) => (
            <div key={entry.tag}>
              <NotesSidebarRow
                data-notes-sidebar-tag-row={entry.tag}
                depth={1}
                rowClassName="h-auto min-h-[var(--vlaina-size-36px)] items-start py-1.5"
                leadingClassName="self-start pt-1"
                contentClassName="min-w-0 overflow-hidden pr-2"
                leading={
                  <span className="relative flex size-[var(--vlaina-size-20px)] items-center justify-center">
                    <span className="text-[var(--vlaina-font-sm)] font-semibold leading-none text-[var(--vlaina-sidebar-notes-folder-icon)] transition-none group-hover/sidebar-row:opacity-[var(--vlaina-opacity-0)] group-focus-within/sidebar-row:opacity-[var(--vlaina-opacity-0)]">
                      #
                    </span>
                    <CollapseTriangleAffordance
                      collapsed={!expandedTags.has(entry.tag)}
                      visibility="always"
                      size={themeIconTokens.sizeSm}
                      className="absolute inset-0 opacity-[var(--vlaina-opacity-0)] transition-none group-hover/sidebar-row:opacity-[var(--vlaina-opacity-100)] group-focus-within/sidebar-row:opacity-[var(--vlaina-opacity-100)]"
                      iconClassName="text-[var(--vlaina-sidebar-notes-file-icon)]"
                    />
                  </span>
                }
                main={
                  <span className="block min-w-0 max-w-full whitespace-normal break-words text-[var(--vlaina-font-base)] leading-5 text-[var(--vlaina-sidebar-notes-text)] [overflow-wrap:anywhere]">
                    {entry.tag}
                  </span>
                }
                onClick={() => {
                  setExpandedTags((current) => {
                    const next = new Set(current);
                    if (next.has(entry.tag)) {
                      next.delete(entry.tag);
                    } else {
                      next.add(entry.tag);
                    }
                    return next;
                  });
                }}
              />
              {expandedTags.has(entry.tag) ? (
                <div>
                  <div aria-hidden="true" className="h-2" />
                  {entry.paths.map((target) => (
                    <NotesTagFileRow
                      key={target.path}
                      target={target}
                      currentNotePath={currentNotePath}
                      getDisplayName={getDisplayName}
                      onOpenNote={onOpenNote}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NotesTagFileRow({
  target,
  currentNotePath,
  getDisplayName,
  onOpenNote,
}: {
  target: NotesSidebarTagPath;
  currentNotePath?: string | null;
  getDisplayName: (path: string) => string;
  onOpenNote: (target: NotesSidebarTagPath) => void;
}) {
  const path = target.path;
  const storeIcon = useDisplayIcon(path);
  const notesPath = useNotesStore((state) => state.notesPath);
  const vaultPath = resolveEffectiveVaultPath({ notesPath, currentNotePath: path });
  const cacheKey = useMemo(() => `${vaultPath}\u001f${path}`, [vaultPath, path]);
  const [fallbackIcon, setFallbackIcon] = useState<string | undefined>(() =>
    tagNoteIconCache.get(cacheKey)?.icon ?? undefined
  );
  const noteIcon = storeIcon || fallbackIcon;

  useEffect(() => {
    if (storeIcon) {
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    void readTagNoteIcon(path, vaultPath || null, cacheKey, abortController.signal)
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
  }, [cacheKey, path, storeIcon, vaultPath]);

  return (
    <NotesSidebarRow
      data-notes-sidebar-tag-file-row="true"
      data-notes-sidebar-tag-file-path={path}
      depth={2}
      rowClassName="h-auto min-h-[var(--vlaina-size-36px)] items-start py-1.5"
      leadingClassName="self-start pt-1"
      contentClassName="min-w-0 overflow-hidden pr-2"
      leading={
        noteIcon ? (
          <NoteIcon icon={noteIcon} notePath={path} size={NOTES_SIDEBAR_ICON_SIZE} />
        ) : (
          <Icon
            name="file.text"
            size={NOTES_SIDEBAR_ICON_SIZE}
            className="text-[var(--vlaina-sidebar-notes-file-icon)]"
          />
        )
      }
      isActive={currentNotePath === path}
      main={
        <span className="block min-w-0 max-w-full whitespace-normal break-words text-[var(--vlaina-font-base)] leading-5 text-[var(--vlaina-sidebar-notes-text)] [overflow-wrap:anywhere]">
          {getDisplayName(path) || stripMarkdownExtension(path.split('/').pop() ?? '') || path}
        </span>
      }
      onClick={() => onOpenNote(target)}
    />
  );
}
