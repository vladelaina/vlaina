import { useEffect, useState } from 'react';
import { NotesSidebarRow } from './NotesSidebarRow';
import type { NotesSidebarTagEntry, NotesSidebarTagPath } from './notesSidebarTags';
import {
  CollapseTriangleAffordance,
  getSidebarCollapseTriangleColorClassName,
} from '../common/collapseTrianglePrimitive';
import { useI18n } from '@/lib/i18n';
import { themeIconTokens } from '@/styles/themeTokens';
import { cn } from '@/lib/utils';
import { NotesTagFileRow } from './NotesTagFileRow';
export { MAX_CONCURRENT_TAG_NOTE_ICON_METADATA_READS } from './tagNoteIconMetadata';

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
      let changed = false;
      current.forEach((tag) => {
        if (nextTags.has(tag)) {
          nextExpanded.add(tag);
        } else {
          changed = true;
        }
      });
      return changed || nextExpanded.size !== current.size ? nextExpanded : current;
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
            <span className="text-[length:var(--vlaina-notes-ui-font-compact)] font-semibold leading-none text-[var(--vlaina-sidebar-notes-folder-icon)] transition-none group-hover/sidebar-row:opacity-[var(--vlaina-opacity-0)] group-focus-within/sidebar-row:opacity-[var(--vlaina-opacity-0)]">
              #
            </span>
            <CollapseTriangleAffordance
              collapsed={!expanded}
              visibility="always"
              size={themeIconTokens.sizeSm}
              className={cn(
                'absolute inset-0 opacity-[var(--vlaina-opacity-0)] transition-none group-hover/sidebar-row:opacity-[var(--vlaina-opacity-100)] group-focus-within/sidebar-row:opacity-[var(--vlaina-opacity-100)]',
                getSidebarCollapseTriangleColorClassName({ rowHover: true }),
              )}
            />
          </span>
        }
        main={
          <span className="block min-w-0 max-w-full truncate text-[length:var(--vlaina-notes-ui-font-compact)] text-[var(--vlaina-sidebar-notes-text)]">
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
                    <span className="text-[length:var(--vlaina-notes-ui-font-compact)] font-semibold leading-none text-[var(--vlaina-sidebar-notes-folder-icon)] transition-none group-hover/sidebar-row:opacity-[var(--vlaina-opacity-0)] group-focus-within/sidebar-row:opacity-[var(--vlaina-opacity-0)]">
                      #
                    </span>
                    <CollapseTriangleAffordance
                      collapsed={!expandedTags.has(entry.tag)}
                      visibility="always"
                      size={themeIconTokens.sizeSm}
                      className={cn(
                        'absolute inset-0 opacity-[var(--vlaina-opacity-0)] transition-none group-hover/sidebar-row:opacity-[var(--vlaina-opacity-100)] group-focus-within/sidebar-row:opacity-[var(--vlaina-opacity-100)]',
                        getSidebarCollapseTriangleColorClassName({ rowHover: true }),
                      )}
                    />
                  </span>
                }
                main={
                  <span className="block min-w-0 max-w-full whitespace-normal break-words text-[length:var(--vlaina-notes-ui-font-compact)] leading-5 text-[var(--vlaina-sidebar-notes-text)] [overflow-wrap:anywhere]">
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
