import { Icon } from '@/components/ui/icons';
import { type FileTreeSortMode } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';
import { NotesSidebarContextMenu } from './NotesSidebarContextMenu';
import {
  NotesSidebarContextMenuContent,
  type NotesSidebarMenuEntry,
} from './context-menu/NotesSidebarContextMenuContent';
import { type NotesSidebarMenuPosition } from './context-menu/shared';
import {
  FILE_TREE_SORT_OPTIONS,
  getFileTreeSortLabel,
} from '@/stores/notes/fileTreeSorting';
import { useTreeItemPathActions } from '../FileTree/hooks/useTreeItemPathActions';

interface RootFolderMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: NotesSidebarMenuPosition;
  expanded: boolean;
  setExpanded: (value: boolean | ((value: boolean) => boolean)) => void;
  onCreateNote: () => Promise<unknown>;
  onCreateFolder: () => Promise<string | null>;
  onStartRename: () => void;
  fileTreeSortMode: FileTreeSortMode;
  onSelectSortMode: (mode: FileTreeSortMode) => void;
  vaultPath: string;
}

const sortOptionIconNameByMode: Record<FileTreeSortMode, Parameters<typeof Icon>[0]['name']> = {
  'name-asc': 'nav.chevronUp',
  'name-desc': 'nav.chevronDown',
  'updated-desc': 'common.refresh',
  'created-desc': 'common.add',
};

export function RootFolderMenu({
  isOpen,
  onClose,
  position,
  expanded,
  setExpanded,
  onCreateNote,
  onCreateFolder,
  onStartRename,
  fileTreeSortMode,
  onSelectSortMode,
  vaultPath,
}: RootFolderMenuProps) {
  const currentSortLabel = getFileTreeSortLabel(fileTreeSortMode);
  const { handleCopyPath, handleOpenLocation } = useTreeItemPathActions({
    notesPath: vaultPath,
    itemPath: vaultPath,
    openLocationErrorMessage: 'Failed to open folder location.',
  });

  const entries: NotesSidebarMenuEntry[] = [
    {
      key: 'new-note',
      icon: <Icon name="file.add" size="md" />,
      label: 'New Note',
      onClick: async () => {
        if (!expanded) {
          setExpanded(true);
        }
        await onCreateNote();
        onClose();
      },
    },
    {
      key: 'new-folder',
      icon: <Icon name="file.folder" size="md" />,
      label: 'New Folder',
      onClick: async () => {
        if (!expanded) {
          setExpanded(true);
        }
        const createdPath = await onCreateFolder();
        if (!createdPath) {
          return;
        }
        onClose();
      },
    },
    {
      key: 'rename',
      icon: <Icon name="common.rename" size="md" />,
      label: 'Rename',
      onClick: () => {
        onStartRename();
        onClose();
      },
    },
    {
      kind: 'divider',
      key: 'divider-main',
    },
    {
      kind: 'submenu',
      key: 'sort',
      icon: <Icon name="common.sort" size="md" />,
      label: currentSortLabel,
      children: FILE_TREE_SORT_OPTIONS.map((option) => ({
        key: option.value,
        icon: <Icon name={sortOptionIconNameByMode[option.value]} size="md" />,
        label: option.label,
        onClick: () => {
          onSelectSortMode(option.value);
          onClose();
        },
        className: cn(
          'py-1.5 text-[13px]',
          option.value === fileTreeSortMode && 'bg-[var(--notes-sidebar-row-hover)]',
        ),
      })),
    },
    {
      kind: 'submenu',
      key: 'more',
      icon: <Icon name="common.more" size="md" />,
      label: 'More',
      children: [
        {
          key: 'copy-path',
          icon: <Icon name="common.copy" size="md" />,
          label: 'Copy Path',
          onClick: async () => {
            onClose();
            await handleCopyPath();
          },
          disabled: !vaultPath,
        },
        {
          key: 'open-folder-location',
          icon: <Icon name="file.folderOpen" size="md" />,
          label: 'Open Folder Location',
          onClick: async () => {
            onClose();
            await handleOpenLocation();
          },
          disabled: !vaultPath,
        },
      ],
    },
  ];

  return (
    <NotesSidebarContextMenu isOpen={isOpen} onClose={onClose} position={position}>
      <NotesSidebarContextMenuContent entries={entries} />
    </NotesSidebarContextMenu>
  );
}
