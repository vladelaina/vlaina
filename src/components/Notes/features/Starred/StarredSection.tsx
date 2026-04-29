import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useFileTreePointerDragState } from '../FileTree/hooks/fileTreePointerDragState';
import { NotesSidebarSection } from '../Sidebar/NotesSidebarPrimitives';
import { ExternalStarredEntryRow } from './ExternalStarredEntryRow';
import { useStarredSectionEntries } from './useStarredSectionEntries';

interface StarredSectionProps {
  nested?: boolean;
  showTitle?: boolean;
}

export function StarredSection({
  nested = false,
  showTitle = true,
}: StarredSectionProps = {}) {
  const { starredLoaded, hasEntries, entries: entryViewModels } = useStarredSectionEntries();
  const activeDragSourcePath = useFileTreePointerDragState((state) => state.activeSourcePath);
  const isDragOver = useFileTreePointerDragState((state) => state.dropTargetKind === 'starred');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (starredLoaded && hasEntries) {
      setExpanded(true);
    }
  }, [hasEntries, starredLoaded]);

  if (!starredLoaded || (!hasEntries && !activeDragSourcePath)) {
    return null;
  }

  const content = (
    <div
      data-file-tree-starred-drop-target="true"
      className={cn(
        'rounded-md transition-colors',
        isDragOver && 'bg-[var(--notes-sidebar-row-drag)] ring-1 ring-[var(--vlaina-accent)]',
      )}
    >
      {!hasEntries ? (
        <div className="flex min-h-8 items-center gap-2 rounded-md px-2 text-[12px] text-[var(--notes-sidebar-text-soft)]">
          <Icon name="misc.star" size="sm" className="fill-amber-500 text-amber-500" />
          <span>Starred</span>
        </div>
      ) : entryViewModels.map(({ entry, isCurrentVaultEntry, isActive, onOpen, onRemove }) => (
        <ExternalStarredEntryRow
          key={entry.id}
          entry={entry}
          isCurrentVaultEntry={isCurrentVaultEntry}
          isActive={isActive}
          onOpen={onOpen}
          onRemove={onRemove}
        />
      ))}
    </div>
  );

  if (!showTitle) {
    return content;
  }

  return (
    <NotesSidebarSection
      title="Starred"
      expanded={expanded}
      onToggle={() => setExpanded((value) => !value)}
      animated={false}
      nested={nested}
      headerClassName={nested ? 'px-2' : undefined}
      data-file-tree-starred-drop-target="true"
      className={cn(isDragOver && 'rounded-md bg-[var(--notes-sidebar-row-drag)]')}
    >
      {content}
    </NotesSidebarSection>
  );
}
