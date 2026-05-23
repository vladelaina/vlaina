import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Icon } from '@/components/ui/icons';
import { useNotesStore } from '@/stores/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import { SidebarRowActionButton } from '@/components/layout/sidebar/SidebarRow';
import { type FolderNode } from '@/stores/useNotesStore';
import { useI18n } from '@/lib/i18n';
import { cn, iconButtonStyles } from '@/lib/utils';
import {
  getSidebarTextClass,
  SIDEBAR_LABEL_TEXT_METRICS_CLASS,
} from '@/components/layout/sidebar/sidebarLabelStyles';
import { NotesSidebarList } from './NotesSidebarPrimitives';
import { NotesSidebarRow } from './NotesSidebarRow';
import { RootFolderMenu } from './RootFolderMenu';
import { FileTreeItem } from '../FileTree';
import { shouldVirtualizeFileTree, VirtualizedFileTree } from '../FileTree/VirtualizedFileTree';
import { countVisibleFileTreeRows } from '../FileTree/virtualFileTree';
import { CollapseTriangleAffordance } from '../common/collapseTrianglePrimitive';
import { getSidebarContextMenuPosition } from '../common/sidebarMenuPosition';
import { useFileTreePointerDragState } from '../FileTree/hooks/fileTreePointerDragState';
import { useExternalFileTreeDropState } from '../FileTree/hooks/externalFileTreeDropState';
import { useRootBlankContextMenu } from './useRootBlankContextMenu';
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
  blankContextMenuRef?: RefObject<HTMLElement | null>;
  scrollRootRef?: RefObject<HTMLElement | null>;
  active?: boolean;
}

export function RootFolderRow({
  rootFolder,
  isLoading,
  onCreateNote,
  onCreateFolder,
  blankContextMenuRef,
  scrollRootRef,
  active = true,
}: RootFolderRowProps) {
  const { t } = useI18n();
  const currentVault = useVaultStore((state) => state.currentVault);
  const renameCurrentVault = useVaultStore((state) => state.renameCurrentVault);
  const notesPath = useNotesStore((state) => state.notesPath);
  const fileTreeSortMode = useNotesStore((state) => state.fileTreeSortMode);
  const setFileTreeSortMode = useNotesStore((state) => state.setFileTreeSortMode);
  const toggleFolder = useNotesStore((state) => state.toggleFolder);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [shouldRenderChildren, setShouldRenderChildren] = useState(rootFolder?.expanded ?? true);
  const rootRowRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isRenamingRef = useRef(false);
  const isInternalRootDragOver = useFileTreePointerDragState(
    (state) => active && state.dropTargetKind === 'folder' && state.dropTargetPath === '',
  );
  const isExternalRootDragOver = useExternalFileTreeDropState(
    (state) => active && state.dropTargetKind === 'folder' && state.dropTargetPath === '',
  );
  const isRootDragOver = isInternalRootDragOver || isExternalRootDragOver;
  const autoExpandDelayMs = isInternalRootDragOver
    ? INTERNAL_ROOT_AUTO_EXPAND_DELAY_MS
    : EXTERNAL_ROOT_AUTO_EXPAND_DELAY_MS;
  const autoExpandTimeoutRef = useRef<number | null>(null);

  const title = currentVault?.name || rootFolder?.name || 'Grimoire';
  const vaultPath = currentVault?.path ?? '';
  const hasChildren = rootFolder ? rootFolder.children.length > 0 : false;
  const expanded = rootFolder?.expanded ?? true;
  const displayExpanded = !hasChildren || expanded;
  const visibleFileTreeRowCount = useMemo(
    () => rootFolder ? countVisibleFileTreeRows(rootFolder.children) : 0,
    [rootFolder],
  );
  const useVirtualFileTree = Boolean(
    scrollRootRef && shouldVirtualizeFileTree(visibleFileTreeRowCount),
  );
  const isRootTreePending = Boolean(currentVault && notesPath === currentVault.path && !rootFolder);
  const isRootBusy = isLoading || isRootTreePending;
  const setExpanded = (value: boolean | ((value: boolean) => boolean)) => {
    if (!hasChildren) {
      return;
    }

    const nextValue = typeof value === 'function' ? value(expanded) : value;
    if (nextValue !== expanded) {
      toggleFolder('');
    }
  };

  useEffect(() => {
    isRenamingRef.current = isRenaming;
  }, [isRenaming]);

  useEffect(() => {
    if (!expanded) {
      setShouldRenderChildren(false);
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setShouldRenderChildren(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [expanded]);

  useEffect(() => {
    if (isRenaming) {
      return;
    }

    setRenameValue(title);
  }, [isRenaming, title]);

  useEffect(() => {
    if (!active || !rootFolder) {
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
  }, [active, rootFolder]);

  useRootBlankContextMenu({
    enabled: active && Boolean(rootFolder),
    blankContextMenuRef,
    rootRowRef,
    onOpen: (position) => {
      setMenuPosition(position);
      setShowMenu(true);
    },
  });

  useEffect(() => {
    if (autoExpandTimeoutRef.current !== null) {
      window.clearTimeout(autoExpandTimeoutRef.current);
      autoExpandTimeoutRef.current = null;
    }

    if (!active || !isRootDragOver || expanded) {
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
  }, [active, autoExpandDelayMs, expanded, isInternalRootDragOver, isRootDragOver]);

  if (!rootFolder && isRootTreePending) {
    return (
      <div
        ref={rootRowRef}
        className="py-1 pointer-events-none"
        aria-busy={isRootBusy || undefined}
        data-notes-sidebar-root-loading-shell="true"
      >
        <NotesSidebarRow
          data-file-tree-root-drop-target="true"
          leading={
            <span className="relative flex size-[20px] items-center justify-center">
              <Icon
                name="file.folderOpen"
                size={16}
                className="text-[var(--notes-sidebar-folder-icon)]"
              />
            </span>
          }
          main={
            <span className={cn('block whitespace-normal break-all', getSidebarTextClass('notes'))}>
              {title}
            </span>
          }
        />
      </div>
    );
  }

  if (!rootFolder) {
    return null;
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rowElement = event.currentTarget.closest('[data-notes-root-folder-row="true"]');
    const rowRect = (rowElement ?? event.currentTarget).getBoundingClientRect();
    setMenuPosition(getSidebarContextMenuPosition(rowRect, event.clientY));
    setShowMenu(true);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition(
      getSidebarContextMenuPosition(
        event.currentTarget.getBoundingClientRect(),
        event.clientY,
        event.clientX,
      ),
    );
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
    <div
      ref={rootRowRef}
      className={cn('py-1', isRootBusy && 'pointer-events-none')}
      aria-busy={isRootBusy || undefined}
      data-file-tree-primary="true"
    >
      <NotesSidebarRow
        data-file-tree-root-drop-target="true"
        onMouseEnter={() => setHoveredSidebarRenamePath(rootFolder.path)}
        onMouseLeave={() => clearHoveredSidebarRenamePath(rootFolder.path)}
        onContextMenu={handleContextMenu}
        leading={
          <span className="relative flex size-[20px] items-center justify-center">
            <span
              className={cn(
                'transition-none',
                hasChildren && 'group-hover/sidebar-row:opacity-0 group-focus-within/sidebar-row:opacity-0',
              )}
            >
              <Icon
                name={displayExpanded ? 'file.folderOpen' : 'file.folder'}
                size={16}
                className="text-[var(--notes-sidebar-folder-icon)]"
              />
            </span>
            {hasChildren ? (
              <CollapseTriangleAffordance
                collapsed={!expanded}
                visibility="always"
                size={14}
                className="absolute inset-0 opacity-0 transition-none group-hover/sidebar-row:opacity-100 group-focus-within/sidebar-row:opacity-100"
                iconClassName="text-[var(--notes-sidebar-file-icon)]"
              />
            ) : null}
          </span>
        }
        onClick={hasChildren ? () => toggleFolder('') : undefined}
        isHighlighted={showMenu}
        isDragOver={isRootDragOver}
        showActionsByDefault={showMenu}
        data-notes-root-folder-row="true"
        main={
          isRenaming ? (
            <SidebarInlineRenameInput
              value={renameValue}
              onValueChange={setRenameValue}
              onSubmit={handleRenameSubmit}
              onCancel={() => setIsRenaming(false)}
              className={cn(
                'w-full min-w-0 border-none bg-transparent p-0 outline-none',
                SIDEBAR_LABEL_TEXT_METRICS_CLASS,
                getSidebarTextClass('notes')
              )}
            />
          ) : (
            <span className={cn('block whitespace-normal break-all', getSidebarTextClass('notes'))}>
              {title}
            </span>
          )
        }
        actions={
          <SidebarRowActionButton
            ref={menuButtonRef}
            aria-label={t('notes.openRootFolderMenu')}
            onClick={(event) => {
              handleMenuOpen(event);
            }}
            className={cn(
              'rounded-md p-1 focus:outline-none',
              iconButtonStyles,
              'text-[var(--notes-sidebar-text)] hover:text-[var(--notes-sidebar-text)]',
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
          if (!hasChildren) {
            return;
          }

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

      {expanded && shouldRenderChildren && rootFolder.children.length > 0 ? (
        <NotesSidebarList>
          {useVirtualFileTree && scrollRootRef ? (
            <VirtualizedFileTree
              nodes={rootFolder.children}
              startDepth={1}
              parentFolderPath=""
              scrollRootRef={scrollRootRef}
            />
          ) : (
            rootFolder.children.map((node) => (
              <FileTreeItem
                key={node.id}
                node={node}
                depth={1}
                parentFolderPath=""
              />
            ))
          )}
        </NotesSidebarList>
      ) : null}
    </div>
  );
}
