import { lazy, memo, Suspense, useCallback, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { getSidebarLabelClass } from '@/components/layout/sidebar/sidebarLabelStyles';
import { useI18n } from '@/lib/i18n';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { resolveNotesRootRelativeFullPath } from '@/stores/notes/utils/fs/notesRootPathContainment';
import { useNotesStore, type ImageFile } from '@/stores/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';
import { themeIconTokens } from '@/styles/themeTokens';
import type { NotesSidebarMenuEntry } from '../Sidebar/context-menu/NotesSidebarContextMenuContent';
import { TreeItemShell } from './components/TreeItemShell';
import { useTreeItemPathActions } from './hooks/useTreeItemPathActions';
import { useTreeItemUiState } from './hooks/useTreeItemUiState';

const TreeItemMenu = lazy(async () => {
  const mod = await import('./components/TreeItemMenu');
  return { default: mod.TreeItemMenu };
});

const LazyChatImageViewer = lazy(async () => {
  const mod = await import('@/components/Chat/features/Markdown/components/LazyChatImageViewer');
  return { default: mod.LazyChatImageViewer };
});

interface ImageFileItemProps {
  node: ImageFile;
  depth: number;
  parentFolderPath?: string;
  showMenuButton?: boolean;
}

export const ImageFileItem = memo(function ImageFileItem({
  node,
  depth,
  parentFolderPath = '',
  showMenuButton = true,
}: ImageFileItemProps) {
  const { t } = useI18n();
  const notesPath = useNotesStore((state) => state.notesPath);
  const addToast = useToastStore((state) => state.addToast);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const {
    showMenu,
    setShowMenu,
    menuPosition,
    handleContextMenu,
    handleMenuTrigger,
  } = useTreeItemUiState({
    path: node.path,
    name: node.name,
    renameEnabled: false,
  });
  const { handleCopyPath, handleOpenLocation } = useTreeItemPathActions({
    notesPath,
    itemPath: node.path,
  });

  const openPreview = useCallback(async () => {
    if (isLoadingPreview) {
      return;
    }

    setShowMenu(false);
    setIsLoadingPreview(true);
    try {
      const { fullPath } = await resolveNotesRootRelativeFullPath(notesPath, node.path);
      const src = await loadImageAsBlob(fullPath);
      setPreviewSrc(src);
      setIsPreviewOpen(true);
    } catch {
      addToast(t('editor.imageFailedToLoad'), 'error');
    } finally {
      setIsLoadingPreview(false);
    }
  }, [addToast, isLoadingPreview, node.path, notesPath, setShowMenu, t]);

  const menuEntries: NotesSidebarMenuEntry[] = [
    {
      key: 'preview',
      icon: <Icon name="file.image" size="md" />,
      label: t('common.preview'),
      onClick: openPreview,
    },
    {
      key: 'copy-path',
      icon: <Icon name="common.copy" size="md" />,
      label: t('sidebar.copyPath'),
      onClick: async () => {
        setShowMenu(false);
        await handleCopyPath();
      },
    },
    {
      key: 'open-location',
      icon: <Icon name="file.folderOpenArrow" size="md" />,
      label: t('sidebar.openFileLocation'),
      onClick: async () => {
        setShowMenu(false);
        await handleOpenLocation();
      },
    },
  ];

  return (
    <>
      <TreeItemShell
        itemPath={node.path}
        itemKind="image"
        parentFolderPath={parentFolderPath}
        depth={depth}
        leading={
          <Icon
            name={isLoadingPreview ? 'common.refresh' : 'file.image'}
            size={themeIconTokens.sizeRow}
            className={isLoadingPreview
              ? 'animate-spin text-[var(--vlaina-sidebar-notes-file-icon)]'
              : 'text-[var(--vlaina-sidebar-notes-file-icon)]'}
          />
        }
        isHighlighted={showMenu}
        onClick={(event) => {
          event.stopPropagation();
          void openPreview();
        }}
        onContextMenu={handleContextMenu}
        showActionsByDefault={showMenu}
        showMenuButton={showMenuButton}
        menuButtonLabel={t('sidebar.openFileMenu')}
        onMenuClick={handleMenuTrigger}
        main={
          <span className={getSidebarLabelClass('notes', { selected: showMenu })}>
            {node.name}
          </span>
        }
      >
        {showMenu ? (
          <Suspense fallback={null}>
            <TreeItemMenu
              isOpen={showMenu}
              onClose={() => setShowMenu(false)}
              position={menuPosition}
              entries={menuEntries}
            />
          </Suspense>
        ) : null}
      </TreeItemShell>

      {previewSrc ? (
        <Suspense fallback={null}>
          <LazyChatImageViewer
            open={isPreviewOpen}
            src={previewSrc}
            alt={node.name}
            onOpenChange={setIsPreviewOpen}
          />
        </Suspense>
      ) : null}
    </>
  );
}, (previous, next) => (
  previous.node === next.node &&
  previous.depth === next.depth &&
  previous.parentFolderPath === next.parentFolderPath &&
  previous.showMenuButton === next.showMenuButton
));
