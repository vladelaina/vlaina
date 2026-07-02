import { Icon } from '@/components/ui/icons';
import { type FileTreeSortMode } from '@/stores/useNotesStore';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
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
import { useI18n } from '@/lib/i18n';

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
  notesRootPath: string;
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
  notesRootPath,
}: RootFolderMenuProps) {
  const { t } = useI18n();
  const sortLabelByMode: Record<FileTreeSortMode, string> = {
    'name-asc': t('sidebar.nameAsc'),
    'name-desc': t('sidebar.nameDesc'),
    'updated-desc': t('sidebar.recentlyUpdated'),
    'created-desc': t('sidebar.recentlyCreated'),
  };
  const currentSortLabel = sortLabelByMode[fileTreeSortMode] ?? getFileTreeSortLabel(fileTreeSortMode);
  const closeNotesRoot = useNotesRootStore((state) => state.closeNotesRoot);
  const { handleCopyPath, handleOpenInNewWindow, handleOpenLocation } = useTreeItemPathActions({
    notesPath: notesRootPath,
    itemPath: '',
    openLocationErrorMessage: t('notes.openFolderLocationFailed'),
  });

  const entries: NotesSidebarMenuEntry[] = [
    {
      key: 'new-note',
      icon: <Icon name="file.add" size="md" />,
      label: t('sidebar.newNote'),
      onClick: async () => {
        if (!expanded) {
          setExpanded(true);
        }
        onClose();
        await onCreateNote();
      },
    },
    {
      key: 'new-folder',
      icon: <Icon name="file.folderOutline" size="md" />,
      label: t('sidebar.newFolder'),
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
      label: t('sidebar.rename'),
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
        label: sortLabelByMode[option.value] ?? t(option.labelKey),
        onClick: () => {
          onSelectSortMode(option.value);
          onClose();
        },
        className: cn(
          'py-1.5 text-[var(--vlaina-font-base)]',
          option.value === fileTreeSortMode && 'bg-[var(--vlaina-sidebar-notes-row-hover)]',
        ),
      })),
    },
    {
      kind: 'submenu',
      key: 'more',
      icon: <Icon name="common.more" size="md" />,
      label: t('sidebar.more'),
      children: [
        {
          key: 'copy-path',
          icon: <Icon name="common.copy" size="md" />,
          label: t('sidebar.copyPath'),
          onClick: async () => {
            onClose();
            await handleCopyPath();
          },
          disabled: !notesRootPath,
        },
        {
          key: 'open-new-window',
          icon: <Icon name="file.folderOutput" size="md" />,
          label: t('sidebar.openInNewWindow'),
          onClick: async () => {
            onClose();
            await handleOpenInNewWindow('folder');
          },
          disabled: !notesRootPath,
        },
        {
          key: 'open-folder-location',
          icon: <Icon name="file.folderOpenArrow" size="md" />,
          label: t('sidebar.openFolderLocation'),
          onClick: async () => {
            onClose();
            await handleOpenLocation('folder');
          },
          disabled: !notesRootPath,
        },
      ],
    },
    {
      key: 'close-folder',
      icon: <Icon name="common.close" size="md" />,
      label: t('sidebar.closeFolder'),
      onClick: async () => {
        if (!notesRootPath) return;
        onClose();
        await closeNotesRoot();
      },
      disabled: !notesRootPath,
    },
  ];

  return (
    <NotesSidebarContextMenu isOpen={isOpen} onClose={onClose} position={position}>
      <NotesSidebarContextMenuContent entries={entries} />
    </NotesSidebarContextMenu>
  );
}
