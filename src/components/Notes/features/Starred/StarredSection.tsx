import { useEffect, useState } from 'react';
import { FileItem } from '../FileTree/FileItem';
import { FolderItem } from '../FileTree/FolderItem';
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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (starredLoaded && hasEntries) {
      setExpanded(true);
    }
  }, [hasEntries, starredLoaded]);

  if (!starredLoaded || !hasEntries) {
    return null;
  }

  const content = (
    <div>
      {entryViewModels.map(({ entry, isCurrentVaultEntry, isActive, treeNode, onOpen, onRemove }) => {
        if (isCurrentVaultEntry && treeNode) {
          return treeNode.isFolder ? (
            <FolderItem
              key={entry.id}
              node={treeNode}
              depth={0}
              showStarBadge
              dragEnabled={false}
            />
          ) : (
            <FileItem
              key={entry.id}
              node={treeNode}
              depth={0}
              showStarBadge
              dragEnabled={false}
            />
          );
        }

        return (
          <ExternalStarredEntryRow
            key={entry.id}
            entry={entry}
            isCurrentVaultEntry={isCurrentVaultEntry}
            isActive={isActive}
            onOpen={onOpen}
            onRemove={onRemove}
          />
        );
      })}
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
    >
      {content}
    </NotesSidebarSection>
  );
}
