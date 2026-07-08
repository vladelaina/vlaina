import { useEffect } from 'react';
import { AppViewModeSwitch } from '@/components/layout/sidebar/AppViewModeSwitch';
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
import { useWhiteboardStore } from './stores/useWhiteboardStore';

export function WhiteboardSidebar() {
  const { t } = useI18n();
  const notesRootPath = useNotesRootStore((state) => state.currentNotesRoot?.path ?? null);
  const activeBoardId = useWhiteboardStore((state) => state.activeBoardId);
  const boards = useWhiteboardStore((state) => state.boards);
  const createBoard = useWhiteboardStore((state) => state.createBoard);
  const loadWhiteboards = useWhiteboardStore((state) => state.loadForNotesRoot);
  const selectBoard = useWhiteboardStore((state) => state.selectBoard);

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
              return (
                <button
                  key={board.id}
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  className={[
                    'flex h-[var(--vlaina-size-36px)] w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-[var(--vlaina-font-base)] font-medium leading-none',
                    selected ? getSidebarSelectedRowSurfaceClass('notes') : getSidebarIdleRowSurfaceClass('notes'),
                  ].join(' ')}
                  onClick={() => {
                    void selectBoard(board.id).catch(() => undefined);
                  }}
                >
                  <Icon name="editor.diagram" size={themeIconTokens.sizeCompact} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{board.title}</span>
                </button>
              );
            })}
          </SidebarList>
        </SidebarScrollArea>
      </SidebarCapsulePanel>
    </SidebarSurface>
  );
}
