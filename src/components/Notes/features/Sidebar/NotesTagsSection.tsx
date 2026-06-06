import { useEffect, useMemo, useState } from 'react';
import { getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
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
import { themeIconTokens } from '@/styles/themeTokens';

const MAX_TAG_NOTE_ICON_CACHE_ENTRIES = 300;
const MAX_TAG_NOTE_ICON_METADATA_BYTES = 512 * 1024;

interface TagNoteIconCacheEntry {
  modifiedAt: number | null;
  size: number | null;
  icon: string | null;
}

const tagNoteIconCache = new Map<string, TagNoteIconCacheEntry>();

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

async function readTagNoteIcon(path: string, vaultPath: string | null): Promise<TagNoteIconCacheEntry> {
  const fullPath = isAbsolutePath(path)
    ? path
    : vaultPath
      ? await joinPath(vaultPath, path)
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

  const content = await storage.readFile(fullPath);
  if (content.length > MAX_TAG_NOTE_ICON_METADATA_BYTES) {
    return { modifiedAt, size, icon: null };
  }

  return {
    modifiedAt,
    size,
    icon: readNoteMetadataFromMarkdown(content).icon ?? null,
  };
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
    <div className="min-w-0 w-full overflow-hidden rounded-md">
      <NotesSidebarRow
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

    const cached = tagNoteIconCache.get(cacheKey);
    if (cached) {
      setFallbackIcon(cached.icon ?? undefined);
      return;
    }

    let cancelled = false;
    void readTagNoteIcon(path, vaultPath || null)
      .then((entry) => {
        setTagNoteIconCacheEntry(cacheKey, entry);
        if (!cancelled) {
          setFallbackIcon(entry.icon ?? undefined);
        }
      })
      .catch(() => {
        setTagNoteIconCacheEntry(cacheKey, { modifiedAt: null, size: null, icon: null });
        if (!cancelled) {
          setFallbackIcon(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, path, storeIcon, vaultPath]);

  return (
    <NotesSidebarRow
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
