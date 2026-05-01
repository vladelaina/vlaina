import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useNotesStore } from '@/stores/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import { SidebarRowActionButton } from '@/components/layout/sidebar/SidebarRow';
import { type FolderNode } from '@/stores/useNotesStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { getSidebarTextClass } from '@/components/layout/sidebar/sidebarLabelStyles';
import { NotesSidebarList } from './NotesSidebarPrimitives';
import { NotesSidebarRow } from './NotesSidebarRow';
import { RootFolderMenu } from './RootFolderMenu';
import { FileTreeItem } from '../FileTree';
import { CollapseTriangleAffordance } from '../common/collapseTrianglePrimitive';
import { getSidebarContextMenuPosition, getSidebarMenuPositionFromTriggerRect } from '../common/sidebarMenuPosition';
import { useFileTreePointerDragState } from '../FileTree/hooks/fileTreePointerDragState';
import { useExternalFileTreeDropState } from '../FileTree/hooks/externalFileTreeDropState';
import {
  clearHoveredSidebarRenamePath,
  registerSidebarHoverRenameTarget,
  setHoveredSidebarRenamePath,
} from '../common/sidebarHoverRename';

const INTERNAL_ROOT_AUTO_EXPAND_DELAY_MS = 120;
const EXTERNAL_ROOT_AUTO_EXPAND_DELAY_MS = 560;

interface RootFolderRowProps {
  rootFolder: FolderNode | null;
  isLoading: boolean;
  onCreateNote: () => Promise<unknown>;
  onCreateFolder: () => Promise<string | null>;
}

export function RootFolderRow({
  rootFolder,
  isLoading,
  onCreateNote,
  onCreateFolder,
}: RootFolderRowProps) {
  const currentVault = useVaultStore((state) => state.currentVault);
  const renameCurrentVault = useVaultStore((state) => state.renameCurrentVault);
  const fileTreeSortMode = useNotesStore((state) => state.fileTreeSortMode);
  const setFileTreeSortMode = useNotesStore((state) => state.setFileTreeSortMode);
  const toggleFolder = useNotesStore((state) => state.toggleFolder);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isRenamingRef = useRef(false);
  const isInternalRootDragOver = useFileTreePointerDragState(
    (state) => state.dropTargetKind === 'folder' && state.dropTargetPath === '',
  );
  const isExternalRootDragOver = useExternalFileTreeDropState(
    (state) => state.dropTargetKind === 'folder' && state.dropTargetPath === '',
  );
  const isRootDragOver = isInternalRootDragOver || isExternalRootDragOver;
  const autoExpandDelayMs = isInternalRootDragOver
    ? INTERNAL_ROOT_AUTO_EXPAND_DELAY_MS
    : EXTERNAL_ROOT_AUTO_EXPAND_DELAY_MS;
  const isDragOver = isRootDragOver;
  const autoExpandTimeoutRef = useRef<number | null>(null);

  const title = currentVault?.name || rootFolder?.name || 'Notes';
  const vaultPath = currentVault?.path ?? '';
  const hasChildren = rootFolder ? rootFolder.children.length > 0 : false;
  const expanded = rootFolder?.expanded ?? true;
  const setExpanded = (value: boolean | ((value: boolean) => boolean)) => {
    const nextValue = typeof value === 'function' ? value(expanded) : value;
    if (nextValue !== expanded) {
      toggleFolder('');
    }
  };

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
  }, [rootFolder]);

  useEffect(() => {
    if (autoExpandTimeoutRef.current !== null) {
      window.clearTimeout(autoExpandTimeoutRef.current);
      autoExpandTimeoutRef.current = null;
    }

    if (!isRootDragOver || expanded) {
      return;
    }

    autoExpandTimeoutRef.current = window.setTimeout(() => {
      setExpanded(true);
      autoExpandTimeoutRef.current = null;
    }, autoExpandDelayMs);

    return () => {
      if (autoExpandTimeoutRef.current !== null) {
        window.clearTimeout(autoExpandTimeoutRef.current);
        autoExpandTimeoutRef.current = null;
      }
    };
  }, [autoExpandDelayMs, expanded, isInternalRootDragOver, isRootDragOver]);

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
    setMenuPosition(getSidebarContextMenuPosition(event.currentTarget.getBoundingClientRect(), event.clientY));
    setShowMenu(true);
  };

  const handleRenameSubmit = async () => {
    const trimmedValue = renameValue.trim();
    if (trimmedValue && trimmedValue !== title) {
      await renameCurrentVault(trimmedValue);
    }
    setIsRenaming(false);
  };

  return (
    <div className="py-1">
      <NotesSidebarRow
        data-file-tree-root-drop-target="true"
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
                size={16}
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
        onClick={() => toggleFolder('')}
        isHighlighted={showMenu}
        isDragOver={isDragOver}
        showActionsByDefault={showMenu}
        main={
          isRenaming ? (
            <SidebarInlineRenameInput
              value={renameValue}
              onValueChange={setRenameValue}
              onSubmit={handleRenameSubmit}
              onCancel={() => setIsRenaming(false)}
              className={cn(
                'w-full min-w-0 border-none bg-transparent p-0 text-sm leading-5 outline-none',
                getSidebarTextClass('notes')
              )}
            />
          ) : (
            <span className={cn('block truncate', getSidebarTextClass('notes'))}>
              {title}
            </span>
          )
        }
        actions={
          <SidebarRowActionButton
            ref={menuButtonRef}
            aria-label="Open root folder menu"
            onClick={() => {
              handleMenuOpen();
            }}
            className={cn(
              'rounded-md p-1 focus:outline-none',
              iconButtonStyles,
              showMenu
                ? 'text-[var(--notes-sidebar-icon-hover)] hover:text-[var(--notes-sidebar-text)]'
                : 'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]',
            )}
          >
            <Icon name="common.more" size="md" />
          </SidebarRowActionButton>
        }
      />

      <RootFolderMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        position={menuPosition}
        expanded={expanded}
        setExpanded={(value) => {
          const nextExpanded = typeof value === 'function' ? value(expanded) : value;
          if (nextExpanded !== expanded) {
            toggleFolder('');
          }
        }}
        onCreateNote={onCreateNote}
        onCreateFolder={onCreateFolder}
        onStartRename={() => setIsRenaming(true)}
        fileTreeSortMode={fileTreeSortMode}
        onSelectSortMode={setFileTreeSortMode}
        vaultPath={vaultPath}
      />

      {expanded && rootFolder.children.length > 0 ? (
        <NotesSidebarList>
          {rootFolder.children.map((node) => (
            <FileTreeItem
              key={node.id}
              node={node}
              depth={1}
              parentFolderPath=""
            />
          ))}
        </NotesSidebarList>
      ) : null}
    </div>
  );
}
