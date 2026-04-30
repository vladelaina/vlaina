import { useEffect, useLayoutEffect, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import {
  requestFileTreePointerDragDropTargetUpdate,
  useFileTreePointerDragState,
} from '../FileTree/hooks/fileTreePointerDragState';
import { useExternalFileTreeDropState } from '../FileTree/hooks/externalFileTreeDropState';
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
  const isInternalDragOver = useFileTreePointerDragState((state) => state.dropTargetKind === 'starred');
  const isExternalDragActive = useExternalFileTreeDropState((state) => state.active);
  const isExternalDragOver = useExternalFileTreeDropState((state) => state.dropTargetKind === 'starred');
  const [expanded, setExpanded] = useState(false);
  const hasActiveDrag = activeDragSourcePath != null || isExternalDragActive;
  const isDragOver = isInternalDragOver || isExternalDragOver;
  const isExpanded = expanded || (!hasEntries && hasActiveDrag);

  useEffect(() => {
    if (starredLoaded && hasEntries) {
      setExpanded(true);
    }
  }, [hasEntries, starredLoaded]);

  useLayoutEffect(() => {
    if (!hasEntries && activeDragSourcePath != null) {
      requestFileTreePointerDragDropTargetUpdate();
    }
  }, [activeDragSourcePath, hasEntries, isExpanded]);

  if (!starredLoaded || (!hasEntries && !hasActiveDrag)) {
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
      expanded={isExpanded}
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
