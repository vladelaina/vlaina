import { useMemo, useRef, useState } from 'react';
import { DeleteIcon } from '@/components/common/DeleteIcon';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { createCloudNoteLogicalPath, type CloudRepoNode, type CloudRepoNodeKind } from '@/stores/cloudRepos';
import { useGithubReposStore } from '@/stores/useGithubReposStore';
import { useNotesStore } from '@/stores/useNotesStore';
import { TreeItemDeleteDialog } from '../FileTree/components/TreeItemDeleteDialog';
import { CollapseTriangleIcon } from '../common/collapseTrianglePrimitive';
import {
  NotesSidebarContextMenu,
  NotesSidebarContextMenuDivider,
  NotesSidebarContextMenuItem,
} from '../Sidebar/NotesSidebarContextMenu';
import { NotesSidebarRow } from '../Sidebar/NotesSidebarRow';
import { remapCloudSessionPaths, removeCloudSessionPaths } from './cloudNoteSession';

interface CloudTreeItemProps {
  node: CloudRepoNode;
  repoId: number;
  branch: string;
  depth: number;
}

function CloudTreeMenu({
  kind,
  isOpen,
  onClose,
  position,
  onRename,
  onOpenNewTab,
  onNewNote,
  onNewFolder,
  onDelete,
}: {
  kind: CloudRepoNodeKind;
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  onRename: () => void;
  onOpenNewTab?: () => void;
  onNewNote?: () => void;
  onNewFolder?: () => void;
  onDelete: () => void;
}) {
  return (
    <NotesSidebarContextMenu isOpen={isOpen} onClose={onClose} position={position}>
      <NotesSidebarContextMenuItem
        icon={<Icon name="common.compose" size="md" />}
        label="Rename"
        onClick={onRename}
      />
      {kind === 'file' && onOpenNewTab ? (
        <NotesSidebarContextMenuItem
          icon={<Icon name="nav.external" size="md" />}
          label="Open in New Tab"
          onClick={onOpenNewTab}
        />
      ) : null}
      {kind === 'folder' && onNewNote ? (
        <NotesSidebarContextMenuItem
          icon={<Icon name="file.add" size="md" />}
          label="New Note"
          onClick={onNewNote}
        />
      ) : null}
      {kind === 'folder' && onNewFolder ? (
        <NotesSidebarContextMenuItem
          icon={<Icon name="file.folder" size="md" />}
          label="New Folder"
          onClick={onNewFolder}
        />
      ) : null}
      <NotesSidebarContextMenuDivider />
      <NotesSidebarContextMenuItem
        icon={<DeleteIcon />}
        label="Delete"
        onClick={onDelete}
        danger
      />
    </NotesSidebarContextMenu>
  );
}

export function CloudTreeItem({ node, repoId, branch, depth }: CloudTreeItemProps) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const currentNotePath = useNotesStore((state) => state.currentNote?.path);
  const openCloudNote = useNotesStore((state) => state.openCloudNote);
  const toggleFolder = useGithubReposStore((state) => state.toggleFolder);
  const openRemoteNote = useGithubReposStore((state) => state.openRemoteNote);
  const createRemoteNote = useGithubReposStore((state) => state.createRemoteNote);
  const createRemoteFolder = useGithubReposStore((state) => state.createRemoteFolder);
  const renameRemoteNode = useGithubReposStore((state) => state.renameRemoteNode);
  const deleteRemoteNode = useGithubReposStore((state) => state.deleteRemoteNode);
  const getFileState = useGithubReposStore((state) => state.getFileState);

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name.replace(/\.md$/i, ''));
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const logicalPath = useMemo(
    () => (node.kind === 'file' ? createCloudNoteLogicalPath(repoId, branch, node.path) : null),
    [branch, node.kind, node.path, repoId]
  );
  const draftState =
    node.kind === 'file' ? getFileState(repoId, branch, node.path) : undefined;
  const isActive = logicalPath ? currentNotePath === logicalPath : false;

  const openMenu = (rect: DOMRect) => {
    setMenuPosition({
      top: rect.bottom + 4,
      left: rect.right - 180,
    });
    setShowMenu(true);
  };

  const handleOpen = async (openInNewTab = false) => {
    if (node.kind === 'folder') {
      await toggleFolder(repoId, node.path);
      return;
    }

    const snapshot = await openRemoteNote(repoId, node.path);
    if (snapshot) {
      await openCloudNote(snapshot, openInNewTab);
    }
  };

  const handleRenameSubmit = async () => {
    const trimmedValue = renameValue.trim();
    if (!trimmedValue) {
      setIsRenaming(false);
      setRenameValue(node.name.replace(/\.md$/i, ''));
      return;
    }

    const nextPath = await renameRemoteNode(repoId, node.path, node.kind, trimmedValue);
    if (nextPath && nextPath !== node.path) {
      remapCloudSessionPaths(repoId, branch, node.path, nextPath, node.kind);
    }

    setIsRenaming(false);
  };

  const handleCreateNote = async () => {
    const snapshot = await createRemoteNote(repoId, node.kind === 'folder' ? node.path : '', undefined);
    if (snapshot) {
      await openCloudNote(snapshot);
    }
    setShowMenu(false);
  };

  const handleCreateFolder = async () => {
    await createRemoteFolder(repoId, node.kind === 'folder' ? node.path : '', undefined);
    setShowMenu(false);
  };

  const handleDelete = async () => {
    const success = await deleteRemoteNode(repoId, node.path, node.kind);
    if (success) {
      await removeCloudSessionPaths(repoId, branch, node.path, node.kind);
    }
  };

  return (
    <div className="relative" data-cloud-repo-path={node.path}>
      <NotesSidebarRow
        depth={depth}
        isActive={isActive}
        onClick={() => void handleOpen()}
        onContextMenu={(event) => {
          event.preventDefault();
          if (menuButtonRef.current) {
            openMenu(menuButtonRef.current.getBoundingClientRect());
          }
        }}
        leading={
          node.kind === 'folder' ? (
            <span className="relative flex size-[20px] items-center justify-center">
              <Icon
                name={node.expanded ? 'file.folderOpen' : 'file.folder'}
                size="md"
                className="text-[var(--notes-sidebar-folder-icon)] group-hover/notes-sidebar-row:hidden"
              />
              <CollapseTriangleIcon
                collapsed={!node.expanded}
                size={16}
                className="hidden text-[var(--notes-sidebar-folder-icon)] group-hover/notes-sidebar-row:block"
              />
            </span>
          ) : (
            <Icon name="file.text" size="md" className="text-[var(--notes-sidebar-file-icon)]" />
          )
        }
        main={
          isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={() => void handleRenameSubmit()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleRenameSubmit();
                if (event.key === 'Escape') {
                  setIsRenaming(false);
                  setRenameValue(node.name.replace(/\.md$/i, ''));
                }
              }}
              className="w-full min-w-0 rounded border border-[var(--neko-accent)] bg-transparent px-1.5 py-0.5 text-sm leading-5 text-[var(--notes-sidebar-text)] outline-none"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <span
              className={cn(
                'block truncate text-[13px]',
                isActive ? 'font-medium text-[var(--notes-sidebar-text)]' : 'text-[var(--notes-sidebar-text-muted)]'
              )}
            >
              {node.name.replace(/\.md$/i, '')}
            </span>
          )
        }
        trailing={
          draftState ? (
            <span
              className={cn(
                'text-[10px] font-medium',
                draftState.state === 'conflict'
                  ? 'text-[var(--notes-sidebar-status-danger)]'
                  : 'text-[var(--notes-sidebar-status-warning)]'
              )}
            >
              {draftState.state === 'conflict' ? '!' : 'M'}
            </span>
          ) : undefined
        }
        actions={
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={`Open ${node.kind} menu`}
            onClick={(event) => {
              event.stopPropagation();
              if (!menuButtonRef.current) return;
              if (showMenu) {
                setShowMenu(false);
                return;
              }
              openMenu(menuButtonRef.current.getBoundingClientRect());
            }}
            className={cn(
              'rounded-md p-1 focus:outline-none',
              iconButtonStyles,
              'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]'
            )}
          >
            <Icon name="common.more" size="md" />
          </button>
        }
      />

      <CloudTreeMenu
        kind={node.kind}
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        position={menuPosition}
        onRename={() => {
          setRenameValue(node.name.replace(/\.md$/i, ''));
          setIsRenaming(true);
          setShowMenu(false);
        }}
        onOpenNewTab={node.kind === 'file' ? () => void handleOpen(true) : undefined}
        onNewNote={node.kind === 'folder' ? () => void handleCreateNote() : undefined}
        onNewFolder={node.kind === 'folder' ? () => void handleCreateFolder() : undefined}
        onDelete={() => {
          setShowMenu(false);
          setShowDeleteDialog(true);
        }}
      />

      <TreeItemDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        itemLabel={node.name.replace(/\.md$/i, '')}
        itemType={node.kind === 'file' ? 'Note' : 'Folder'}
        onConfirm={handleDelete}
      />

      {node.kind === 'folder' && node.expanded && node.children?.length ? (
        <div>
          {node.children.map((child) => (
            <CloudTreeItem
              key={child.path}
              node={child}
              repoId={repoId}
              branch={branch}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
