import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { AppViewModeSwitch } from '@/components/layout/sidebar/AppViewModeSwitch';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import {
  SidebarActionButton,
  SidebarActionGroup,
  SidebarCapsulePanel,
  SidebarList,
  SidebarScrollArea,
  SidebarSurface,
} from '@/components/layout/sidebar/SidebarPrimitives';
import { getSidebarIdleRowSurfaceClass, getSidebarSelectedRowSurfaceClass } from '@/components/layout/sidebar/sidebarLabelStyles';
import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { themeIconTokens } from '@/styles/themeTokens';
import type { WhiteboardIndexEntry } from './model/whiteboardRepository';
import { useWhiteboardStore } from './stores/useWhiteboardStore';

export function WhiteboardSidebar() {
  const { t } = useI18n();
  const notesRootPath = useNotesRootStore((state) => state.currentNotesRoot?.path ?? null);
  const activeBoardId = useWhiteboardStore((state) => state.activeBoardId);
  const boards = useWhiteboardStore((state) => state.boards);
  const createBoard = useWhiteboardStore((state) => state.createBoard);
  const deleteBoard = useWhiteboardStore((state) => state.deleteBoard);
  const loadWhiteboards = useWhiteboardStore((state) => state.loadForNotesRoot);
  const renameBoard = useWhiteboardStore((state) => state.renameBoard);
  const selectBoard = useWhiteboardStore((state) => state.selectBoard);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WhiteboardIndexEntry | null>(null);

  useEffect(() => {
    void loadWhiteboards(notesRootPath).catch(() => undefined);
  }, [loadWhiteboards, notesRootPath]);

  return (
    <SidebarSurface className="bg-[var(--vlaina-sidebar-notes-surface)] text-[var(--vlaina-sidebar-notes-text)]">
      <SidebarCapsulePanel>
        <SidebarActionGroup>
          <AppViewModeSwitch />
          <SidebarActionButton
            tone="notes"
            label={t('common.create')}
            icon={<Icon name="common.add" size={themeIconTokens.sizeCompact} />}
            onClick={() => {
              void (async () => {
                await loadWhiteboards(notesRootPath);
                await createBoard();
              })().catch(() => undefined);
            }}
          />
        </SidebarActionGroup>
        <SidebarScrollArea className="pt-1">
          <SidebarList>
            {boards.map((board) => {
              const selected = board.id === activeBoardId;
              const editing = board.id === editingBoardId;
              return (
                <div
                  key={board.id}
                  aria-current={selected ? 'page' : undefined}
                  className={[
                    'group flex min-h-[var(--vlaina-size-36px)] w-full items-center rounded-xl px-1.5 text-left text-[var(--vlaina-font-base)] font-medium leading-none',
                    selected ? getSidebarSelectedRowSurfaceClass('notes') : getSidebarIdleRowSurfaceClass('notes'),
                  ].join(' ')}
                >
                  {editing ? (
                    <SidebarInlineRenameInput
                      aria-label={t('sidebar.rename')}
                      value={editingTitle}
                      onValueChange={setEditingTitle}
                      onCancel={() => setEditingBoardId(null)}
                      onSubmit={async () => {
                        await renameBoard(board.id, editingTitle);
                        setEditingBoardId(null);
                      }}
                      className="min-w-0 flex-1 bg-transparent px-1.5 py-2 outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      className="min-w-0 flex-1 cursor-pointer truncate px-1.5 py-2 text-left"
                      onClick={() => {
                        void selectBoard(board.id).catch(() => undefined);
                      }}
                      onDoubleClick={() => {
                        setEditingBoardId(board.id);
                        setEditingTitle(board.title);
                      }}
                    >
                      {board.title}
                    </button>
                  )}
                  {!editing ? (
                    <div className="flex shrink-0 items-center opacity-[var(--vlaina-opacity-0)] transition-opacity group-hover:opacity-[var(--vlaina-opacity-100)] group-focus-within:opacity-[var(--vlaina-opacity-100)]">
                      <button
                        type="button"
                        aria-label={t('sidebar.rename')}
                        onClick={() => {
                          setEditingBoardId(board.id);
                          setEditingTitle(board.title);
                        }}
                        className="flex size-[var(--vlaina-size-28px)] cursor-pointer items-center justify-center rounded-[var(--vlaina-radius-circle)] text-[var(--vlaina-sidebar-notes-text-soft)] hover:bg-[var(--vlaina-sidebar-notes-row-active)] hover:text-[var(--vlaina-sidebar-row-selected-text)]"
                      >
                        <Icon name="common.rename" size={themeIconTokens.sizeCompact} />
                      </button>
                      <button
                        type="button"
                        aria-label={t('common.delete')}
                        onClick={() => setDeleteTarget(board)}
                        className="flex size-[var(--vlaina-size-28px)] cursor-pointer items-center justify-center rounded-[var(--vlaina-radius-circle)] text-[var(--vlaina-sidebar-notes-text-soft)] hover:bg-[var(--vlaina-color-status-danger-bg)] hover:text-[var(--vlaina-color-status-danger-fg)]"
                      >
                        <Icon name="common.delete" size={themeIconTokens.sizeCompact} />
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </SidebarList>
        </SidebarScrollArea>
      </SidebarCapsulePanel>
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={t('sidebar.deleteItemTitle', { itemType: t('app.viewWhiteboard') })}
        description={deleteTarget ? t('sidebar.deleteItemDescription', { itemLabel: deleteTarget.title }) : undefined}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        initialFocus="cancel"
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await deleteBoard(deleteTarget.id);
        }}
      />
    </SidebarSurface>
  );
}
