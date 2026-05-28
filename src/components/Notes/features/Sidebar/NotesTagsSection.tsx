import { useEffect, useState } from 'react';
import { NotesSidebarRow } from './NotesSidebarRow';
import type { NotesSidebarTagEntry, NotesSidebarTagPath } from './notesSidebarTags';
import { CollapseTriangleAffordance } from '../common/collapseTrianglePrimitive';
import { useI18n } from '@/lib/i18n';
import { Icon } from '@/components/ui/icons';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';

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
    <div className="w-full rounded-md">
      <NotesSidebarRow
        leading={
          <span className="relative flex size-[20px] items-center justify-center">
            <span className="text-[16px] font-semibold leading-none text-[var(--notes-sidebar-folder-icon)] transition-none group-hover/sidebar-row:opacity-0 group-focus-within/sidebar-row:opacity-0">
              #
            </span>
            <CollapseTriangleAffordance
              collapsed={!expanded}
              visibility="always"
              size={14}
              className="absolute inset-0 opacity-0 transition-none group-hover/sidebar-row:opacity-100 group-focus-within/sidebar-row:opacity-100"
              iconClassName="text-[var(--notes-sidebar-file-icon)]"
            />
          </span>
        }
        main={
          <span className="block truncate text-[16px] text-[var(--notes-sidebar-text)]">
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
                leading={
                  <span className="relative flex size-[20px] items-center justify-center">
                    <span className="text-[14px] font-semibold leading-none text-[var(--notes-sidebar-folder-icon)] transition-none group-hover/sidebar-row:opacity-0 group-focus-within/sidebar-row:opacity-0">
                      #
                    </span>
                    <CollapseTriangleAffordance
                      collapsed={!expandedTags.has(entry.tag)}
                      visibility="always"
                      size={14}
                      className="absolute inset-0 opacity-0 transition-none group-hover/sidebar-row:opacity-100 group-focus-within/sidebar-row:opacity-100"
                      iconClassName="text-[var(--notes-sidebar-file-icon)]"
                    />
                  </span>
                }
                main={
                  <span className="block truncate text-[16px] text-[var(--notes-sidebar-text)]">
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
  const noteIcon = useDisplayIcon(path);

  return (
    <NotesSidebarRow
      depth={2}
      leading={
        noteIcon ? (
          <NoteIcon icon={noteIcon} notePath={path} size={NOTES_SIDEBAR_ICON_SIZE} />
        ) : (
          <Icon
            name="file.text"
            size={NOTES_SIDEBAR_ICON_SIZE}
            className="text-[var(--notes-sidebar-file-icon)]"
          />
        )
      }
      isActive={currentNotePath === path}
      main={
        <span className="block truncate text-[16px] text-[var(--notes-sidebar-text)]">
          {getDisplayName(path) || path.split('/').pop()?.replace(/\.md$/i, '') || path}
        </span>
      }
      onClick={() => onOpenNote(target)}
    />
  );
}
