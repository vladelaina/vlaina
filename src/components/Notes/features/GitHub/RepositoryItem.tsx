import { useState, useRef, useCallback } from 'react';
import { Icon } from '@/components/ui/icons';
import { DeleteIcon } from '@/components/common/DeleteIcon';
import { useGithubReposStore } from '@/stores/useGithubReposStore';
import { useNotesStore } from '@/stores/useNotesStore';
import { type RepositoryInfo } from '@/lib/tauri/githubRepoCommands';
import { CloudRepoTree } from './CloudRepoTree';
import { cn, iconButtonStyles } from '@/lib/utils';
import { CollapseTriangleAffordance } from '../common/collapseTrianglePrimitive';
import {
  NotesSidebarContextMenu,
  NotesSidebarContextMenuDivider,
  NotesSidebarContextMenuItem,
} from '../Sidebar/NotesSidebarContextMenu';
import { NotesSidebarRow } from '../Sidebar/NotesSidebarRow';

interface RepositoryItemProps {
  repository: RepositoryInfo;
  isRefreshing?: boolean;
}

export function RepositoryItem({ repository, isRefreshing = false }: RepositoryItemProps) {
  const {
    expandedRepos,
    toggleRepoExpanded,
    syncStatus,
    syncRepository,
    removeRepository,
    hasChanges,
    getDraftCounts,
    createRemoteNote,
    createRemoteFolder,
  } = useGithubReposStore();
  const openCloudNote = useNotesStore((state) => state.openCloudNote);

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isExpanded = expandedRepos.has(repository.id);
  const status = syncStatus.get(repository.id) || 'synced';
  const isSyncing = status === 'syncing';
  const draftCounts = getDraftCounts(repository.id);
  const repoHasChanges = hasChanges(repository.id);

  const getCloudIcon = () => {
    const iconClass = 'size-[20px] text-[var(--notes-sidebar-icon)]';

    if (isRefreshing || isSyncing) {
      return <Icon name="common.refresh" className={cn(iconClass, 'animate-spin')} />;
    }

    if (draftCounts.conflict > 0) {
      return (
        <Icon
          name="common.error"
          className={cn(iconClass, 'text-[var(--notes-sidebar-status-danger)]')}
        />
      );
    }

    if (repoHasChanges) {
      return (
        <Icon
          name="common.upload"
          className={cn(iconClass, 'text-[var(--notes-sidebar-status-warning)]')}
        />
      );
    }

    return <Icon name="file.cloud" className={iconClass} />;
  };

  const handleClick = useCallback(() => {
    void toggleRepoExpanded(repository.id);
  }, [repository.id, toggleRepoExpanded]);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 160,
      });
    }
    setShowMenu(true);
  };

  const handleSyncNow = async () => {
    setShowMenu(false);
    await syncRepository(repository.id);
  };

  const handleOpenInGitHub = () => {
    window.open(repository.htmlUrl, '_blank');
    setShowMenu(false);
  };

  const handleCreateNote = async () => {
    setShowMenu(false);
    const snapshot = await createRemoteNote(repository.id, '', undefined);
    if (snapshot) {
      await openCloudNote(snapshot);
    }
  };

  const handleCreateFolder = async () => {
    setShowMenu(false);
    await createRemoteFolder(repository.id, '', undefined);
  };

  const handleRemove = () => {
    removeRepository(repository.id);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <NotesSidebarRow
        depth={0}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        leadingClassName="w-10"
        leading={
          <div className="flex w-10 items-center gap-1">
            <span className="flex size-[20px] items-center justify-center">
              <CollapseTriangleAffordance
                collapsed={!isExpanded}
                visibility="always"
                size={16}
                className="size-[20px] text-[var(--notes-sidebar-icon)]"
              />
            </span>
            <span className="flex size-[20px] items-center justify-center">{getCloudIcon()}</span>
          </div>
        }
        main={
          <div className="min-w-0">
            <span className="block truncate text-[13px] text-[var(--notes-sidebar-text)]">
              {repository.displayName}
            </span>
            {draftCounts.dirty > 0 || draftCounts.conflict > 0 ? (
              <span className="truncate text-[11px] text-[var(--notes-sidebar-text-soft)]">
                {draftCounts.conflict > 0
                  ? `${draftCounts.conflict} conflict${draftCounts.conflict > 1 ? 's' : ''}`
                  : `${draftCounts.dirty} unsynced change${draftCounts.dirty > 1 ? 's' : ''}`}
              </span>
            ) : null}
          </div>
        }
        actions={
          <button
            ref={buttonRef}
            type="button"
            aria-label="Open repository menu"
            onClick={(event) => {
              event.stopPropagation();
              if (!showMenu && buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setMenuPosition({
                  top: rect.bottom + 4,
                  left: rect.right - 180,
                });
              }
              setShowMenu(!showMenu);
            }}
            className={cn(
              'rounded-md p-1 focus:outline-none',
              iconButtonStyles,
              'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]'
            )}
          >
            <Icon size="md" name="common.more" />
          </button>
        }
      />

      <NotesSidebarContextMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        position={menuPosition}
      >
        <NotesSidebarContextMenuItem
          icon={<Icon name="file.add" size="md" />}
          label="New Note"
          onClick={handleCreateNote}
        />
        <NotesSidebarContextMenuItem
          icon={<Icon name="file.folder" size="md" />}
          label="New Folder"
          onClick={handleCreateFolder}
        />
        <NotesSidebarContextMenuDivider />
        <NotesSidebarContextMenuItem
          icon={<Icon name="common.refresh" size="md" />}
          label="Sync Now"
          onClick={handleSyncNow}
          disabled={isSyncing}
        />
        <NotesSidebarContextMenuDivider />
        <NotesSidebarContextMenuItem
          icon={<Icon name="nav.external" size="md" />}
          label="Open in GitHub"
          onClick={handleOpenInGitHub}
        />
        <NotesSidebarContextMenuDivider />
        <NotesSidebarContextMenuItem
          icon={<DeleteIcon />}
          label="Hide for Now"
          onClick={handleRemove}
          danger
        />
      </NotesSidebarContextMenu>

      {isExpanded ? (
        <CloudRepoTree
          repoId={repository.id}
          depth={1}
        />
      ) : null}
    </div>
  );
}
