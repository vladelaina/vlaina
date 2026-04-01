import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useNotesStore } from '@/stores/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import { type FileTreeSortMode, type FolderNode } from '@/stores/useNotesStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { NotesSidebarList } from './NotesSidebarPrimitives';
import { NotesSidebarRow } from './NotesSidebarRow';
import {
  NotesSidebarContextMenu,
  NotesSidebarContextMenuDivider,
  NotesSidebarContextMenuItem,
} from './NotesSidebarContextMenu';
import { FileTreeItem } from '../FileTree';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';
import { CollapseTriangleAffordance } from '../common/collapseTrianglePrimitive';
import { getSidebarMenuPositionFromTriggerRect } from '../common/sidebarMenuPosition';
import {
  clearHoveredSidebarRenamePath,
  registerSidebarHoverRenameTarget,
  setHoveredSidebarRenamePath,
} from '../common/sidebarHoverRename';
import {
  FILE_TREE_SORT_OPTIONS,
  getFileTreeSortLabel,
} from '@/stores/notes/fileTreeSorting';

interface RootFolderRowProps {
  rootFolder: FolderNode | null;
  isLoading: boolean;
  currentNotePath?: string | null;
  onCreateNote: () => Promise<unknown>;
  onCreateFolder: () => Promise<string | null>;
}

export function RootFolderRow({
  rootFolder,
  isLoading,
  currentNotePath,
  onCreateNote,
  onCreateFolder,
}: RootFolderRowProps) {
  const currentVault = useVaultStore((state) => state.currentVault);
  const renameCurrentVault = useVaultStore((state) => state.renameCurrentVault);
  const fileTreeSortMode = useNotesStore((state) => state.fileTreeSortMode);
  const setFileTreeSortMode = useNotesStore((state) => state.setFileTreeSortMode);
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isRenamingRef = useRef(false);
  const sortMenuCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (sortMenuCloseTimerRef.current !== null) {
        window.clearTimeout(sortMenuCloseTimerRef.current);
      }
    };
  }, []);

  const title = currentVault?.name || rootFolder?.name || 'Notes';
  const hasChildren = rootFolder ? rootFolder.children.length > 0 : false;

  useEffect(() => {
    isRenamingRef.current = isRenaming;
  }, [isRenaming]);

  useEffect(() => {
    if (isRenaming) {
      return;
    }

    setRenameValue(title);
  }, [isRenaming, title]);

  useEffect(() => {
    if (!rootFolder) {
      return;
    }

    return registerSidebarHoverRenameTarget(rootFolder.path, {
      startRename: () => {
        setIsRenaming(true);
        setShowMenu(false);
      },
      cancelRename: () => {
        setIsRenaming(false);
      },
      isRenaming: () => isRenamingRef.current,
    });
  }, [rootFolder?.path]);

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

  const handleMenuOpen = () => {
    const button = menuButtonRef.current;
    if (!button) return;
    setMenuPosition(getSidebarMenuPositionFromTriggerRect(button.getBoundingClientRect()));
    setShowMenu(true);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ top: event.clientY, left: event.clientX });
    setShowMenu(true);
  };

  const handleCloseMenu = () => {
    if (sortMenuCloseTimerRef.current !== null) {
      window.clearTimeout(sortMenuCloseTimerRef.current);
      sortMenuCloseTimerRef.current = null;
    }
    setShowMenu(false);
    setShowSortOptions(false);
  };

  const openSortOptions = () => {
    if (sortMenuCloseTimerRef.current !== null) {
      window.clearTimeout(sortMenuCloseTimerRef.current);
      sortMenuCloseTimerRef.current = null;
    }
    setShowSortOptions(true);
  };

  const scheduleCloseSortOptions = () => {
    if (sortMenuCloseTimerRef.current !== null) {
      window.clearTimeout(sortMenuCloseTimerRef.current);
    }
    sortMenuCloseTimerRef.current = window.setTimeout(() => {
      setShowSortOptions(false);
      sortMenuCloseTimerRef.current = null;
    }, 120);
  };

  const currentSortLabel = getFileTreeSortLabel(fileTreeSortMode);
  const handleRenameSubmit = async () => {
    const trimmedValue = renameValue.trim();
    if (trimmedValue && trimmedValue !== title) {
      await renameCurrentVault(trimmedValue);
    }
    setIsRenaming(false);
  };

  const sortOptionIconNameByMode: Record<FileTreeSortMode, Parameters<typeof Icon>[0]['name']> = {
    'name-asc': 'nav.chevronUp',
    'name-desc': 'nav.chevronDown',
    'updated-desc': 'common.refresh',
    'created-desc': 'common.add',
  };

  return (
    <div className="py-1">
      <NotesSidebarRow
        onMouseEnter={() => setHoveredSidebarRenamePath(rootFolder.path)}
        onMouseLeave={() => clearHoveredSidebarRenamePath(rootFolder.path)}
        onContextMenu={handleContextMenu}
        leading={
          <span className="relative flex size-[20px] items-center justify-center">
            <span
              className={cn(
                'transition-opacity duration-150',
                hasChildren && 'group-hover/sidebar-row:opacity-0 group-focus-within/sidebar-row:opacity-0',
              )}
            >
              <Icon
                name={expanded ? 'file.folderOpen' : 'file.folder'}
                size={NOTES_SIDEBAR_ICON_SIZE}
                className="text-[var(--notes-sidebar-folder-icon)]"
              />
            </span>
            {hasChildren ? (
              <CollapseTriangleAffordance
                collapsed={!expanded}
                visibility="always"
                size={14}
                className="absolute inset-0 opacity-0 transition-opacity duration-150 group-hover/sidebar-row:opacity-100 group-focus-within/sidebar-row:opacity-100"
                iconClassName="text-[var(--notes-sidebar-file-icon)]"
              />
            ) : null}
          </span>
        }
        onClick={() => setExpanded((value) => !value)}
        isHighlighted={showMenu}
        showActionsByDefault={showMenu}
        main={
          isRenaming ? (
            <SidebarInlineRenameInput
              value={renameValue}
              onValueChange={setRenameValue}
              onSubmit={handleRenameSubmit}
              onCancel={() => setIsRenaming(false)}
              className="w-full min-w-0 border-none bg-transparent p-0 text-sm leading-5 text-[var(--notes-sidebar-text)] outline-none"
            />
          ) : (
            <span className="block truncate text-[var(--notes-sidebar-text)]">
              {title}
            </span>
          )
        }
        actions={
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="Open root folder menu"
            onClick={(event) => {
              event.stopPropagation();
              handleMenuOpen();
            }}
            className={cn(
              'rounded-md p-1 focus:outline-none',
              iconButtonStyles,
              showMenu
                ? 'text-[var(--notes-sidebar-icon-hover)] hover:text-[var(--notes-sidebar-text)]'
                : 'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]'
            )}
          >
            <Icon name="common.more" size="md" />
          </button>
        }
      />

      <NotesSidebarContextMenu
        isOpen={showMenu}
        onClose={handleCloseMenu}
        position={menuPosition}
      >
        <NotesSidebarContextMenuItem
          icon={<Icon name="file.add" size="md" />}
          label="New Note"
          onClick={async () => {
            if (!expanded) setExpanded(true);
            await onCreateNote();
            handleCloseMenu();
          }}
        />
        <NotesSidebarContextMenuItem
          icon={<Icon name="file.folder" size="md" />}
          label="New Folder"
          onClick={async () => {
            if (!expanded) setExpanded(true);
            const createdPath = await onCreateFolder();
            if (!createdPath) {
              return;
            }
            handleCloseMenu();
          }}
        />
        <NotesSidebarContextMenuItem
          icon={<Icon name="common.rename" size="md" />}
          label="Rename"
          onClick={() => {
            setIsRenaming(true);
            handleCloseMenu();
          }}
        />
        <NotesSidebarContextMenuDivider />
        <div
          className="relative"
          onMouseEnter={openSortOptions}
          onMouseLeave={scheduleCloseSortOptions}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openSortOptions();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-[var(--notes-sidebar-text)] outline-none transition-colors hover:bg-[var(--notes-sidebar-row-hover)]"
          >
            <span className="flex size-[20px] items-center justify-center text-[var(--notes-sidebar-icon)]">
              <Icon name="common.sort" size="md" />
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{currentSortLabel}</span>
            <span className="shrink-0 text-[var(--notes-sidebar-icon)]">
              <Icon name="nav.chevronRight" size="sm" />
            </span>
          </button>
          {showSortOptions ? (
            <div
              className="absolute left-full top-0 z-10 min-w-[180px]"
              onMouseEnter={openSortOptions}
              onMouseLeave={scheduleCloseSortOptions}
            >
              <div className="absolute right-full top-0 h-full w-3" />
              <div className="ml-1 rounded-2xl border border-[var(--notes-sidebar-menu-border)] bg-[var(--notes-sidebar-menu-bg)] p-1.5 shadow-[var(--notes-sidebar-menu-shadow)]">
              {FILE_TREE_SORT_OPTIONS.map((option) => {
                return (
                  <NotesSidebarContextMenuItem
                    key={option.value}
                    icon={<Icon name={sortOptionIconNameByMode[option.value]} size="md" />}
                    label={option.label}
                    onClick={() => {
                      void setFileTreeSortMode(option.value);
                      handleCloseMenu();
                    }}
                    className={cn(
                      'py-1.5 text-[13px]',
                      option.value === fileTreeSortMode && 'bg-[var(--notes-sidebar-row-hover)]'
                    )}
                  />
                );
              })}
              </div>
            </div>
          ) : null}
        </div>
      </NotesSidebarContextMenu>

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
