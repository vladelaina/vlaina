import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useVaultStore } from '@/stores/useVaultStore';
import { type FolderNode } from '@/stores/useNotesStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { NotesSidebarList } from './NotesSidebarPrimitives';
import { NotesSidebarRow } from './NotesSidebarRow';
import { FileTreeItem } from '../FileTree';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';

interface RootFolderRowProps {
  rootFolder: FolderNode | null;
  isLoading: boolean;
  currentNotePath?: string | null;
  onCreateNote: () => void;
  onCreateFolder: () => void;
}

export function RootFolderRow({
  rootFolder,
  isLoading,
  currentNotePath,
  onCreateNote,
  onCreateFolder,
}: RootFolderRowProps) {
  const { currentVault } = useVaultStore();
  const [expanded, setExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="py-1">
        <div className="flex h-[30px] items-center gap-2 rounded-md px-3 py-1">
          <div className="h-[18px] w-[18px] rounded bg-[var(--vlaina-bg-tertiary)] animate-pulse" />
          <div className="h-[18px] flex-1 rounded bg-[var(--vlaina-bg-tertiary)] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!rootFolder) {
    return null;
  }

  const title = currentVault?.name || rootFolder.name || 'Notes';

  return (
    <div className="py-1">
      <NotesSidebarRow
        leading={
          <Icon
            name={expanded ? 'file.folderOpen' : 'file.folder'}
            size={NOTES_SIDEBAR_ICON_SIZE}
            className="text-[var(--notes-sidebar-folder-icon)]"
          />
        }
        onClick={() => setExpanded((value) => !value)}
        main={
          <span className="block truncate text-[var(--notes-sidebar-text)]">
            {title}
          </span>
        }
        actions={
          <>
            <button
              type="button"
              aria-label="New note"
              onClick={(event) => {
                event.stopPropagation();
                if (!expanded) setExpanded(true);
                onCreateNote();
              }}
              className={cn(
                'rounded-md p-1 focus:outline-none',
                iconButtonStyles,
                'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]'
              )}
            >
              <Icon name="common.add" size={NOTES_SIDEBAR_ICON_SIZE} />
            </button>
            <button
              type="button"
              aria-label="New folder"
              onClick={(event) => {
                event.stopPropagation();
                if (!expanded) setExpanded(true);
                onCreateFolder();
              }}
              className={cn(
                'rounded-md p-1 focus:outline-none',
                iconButtonStyles,
                'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]'
              )}
            >
              <Icon name="file.folder" size={NOTES_SIDEBAR_ICON_SIZE} />
            </button>
          </>
        }
      />

      {expanded && rootFolder.children.length > 0 ? (
        <NotesSidebarList>
          {rootFolder.children.map((node) => (
            <FileTreeItem
              key={node.id}
              node={node}
              depth={1}
              currentNotePath={currentNotePath ?? undefined}
            />
          ))}
        </NotesSidebarList>
      ) : null}
    </div>
  );
}
