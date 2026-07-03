import { useCallback, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { useUIStore } from '@/stores/uiSlice';
import { useNotesOutline } from './useNotesOutline';
import { NotesSidebarPillEmptyHint, NotesSidebarScrollArea } from '../NotesSidebarPrimitives';
import { NotesSidebarTopActions } from '../NotesSidebarTopActions';
import {
  getEmptyWorkspaceRecentNotesRoots,
  SidebarEmptyWorkspacePanel,
} from '../SidebarEmptyWorkspacePanel';
import { useHeldPageScroll } from '@/hooks/useHeldPageScroll';
import {
  SidebarCapsulePanel,
  SIDEBAR_CAPSULE_SCROLLBAR_INSET_RIGHT,
} from '@/components/layout/sidebar/SidebarPrimitives';
import { NotesOutlineRows } from './NotesOutlineRows';

interface NotesOutlineProps {
  enabled: boolean;
  currentNotePath?: string | null;
  className?: string;
  isPeeking?: boolean;
}

export function NotesOutline({
  enabled,
  currentNotePath,
  className,
  isPeeking = false,
}: NotesOutlineProps) {
  const { t } = useI18n();
  const { headings, activeId, jumpToHeading, renameHeading } = useNotesOutline(enabled);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const currentNotesRoot = useNotesRootStore((s) => s.currentNotesRoot);
  const recentNotesRoots = useNotesRootStore((s) => s.recentNotesRoots);
  const openNotesRoot = useNotesRootStore((s) => s.openNotesRoot);
  const sidebarRootRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const hasCurrentFile = Boolean(currentNotePath && !isDraftNotePath(currentNotePath));
  const shouldShowEmptyWorkspacePanel = headings.length === 0 && !hasCurrentFile && !sidebarCollapsed;
  const shouldShowOutlineEmpty = hasCurrentFile && headings.length === 0;
  const recentEmptyWorkspaceNotesRoots = useMemo(() => (
    getEmptyWorkspaceRecentNotesRoots(recentNotesRoots, currentNotesRoot?.path)
  ), [currentNotesRoot?.path, recentNotesRoots]);

  useHeldPageScroll(scrollRootRef, {
    scopeRef: sidebarRootRef,
    ignoreEditableTargets: true,
  });

  const handleOpenMarkdownFile = useCallback(() => {
    window.dispatchEvent(new Event('app-open-markdown-target-file'));
  }, []);

  const handleOpenFolder = useCallback(() => {
    window.dispatchEvent(new Event('app-open-markdown-target-folder'));
  }, []);

  const handleOpenRecentNotesRoot = useCallback((path: string) => {
    void openNotesRoot(path).catch(() => undefined);
  }, [openNotesRoot]);

  return (
    <div ref={sidebarRootRef} className={cn('flex h-full min-h-0 min-w-0 flex-col', className)}>
      <SidebarCapsulePanel>
        <NotesSidebarTopActions />
        <NotesSidebarScrollArea
          ref={scrollRootRef}
          className={cn(isPeeking ? 'app-scrollbar-rounded pt-4 pb-4' : 'pt-0')}
          scrollbarInsetRight={SIDEBAR_CAPSULE_SCROLLBAR_INSET_RIGHT}
          data-notes-sidebar-scroll-root="true"
        >
          <div className="relative flex min-h-full flex-col">
            {headings.length > 0 ? (
              <nav aria-label={t('notes.documentOutline')} className="space-y-0.5">
                <NotesOutlineRows
                  activeId={activeId}
                  headings={headings}
                  jumpToHeading={jumpToHeading}
                  renameHeading={renameHeading}
                  scrollRootRef={scrollRootRef}
                />
              </nav>
            ) : null}
            <div
              data-notes-sidebar-blank-drag-root="true"
              className={cn('flex flex-1 items-center justify-center', headings.length === 0 && 'min-h-[var(--vlaina-size-160px)]')}
            >
              {shouldShowEmptyWorkspacePanel ? (
                <SidebarEmptyWorkspacePanel
                  folderLabel={t('notes.folder')}
                  openFileLabel={t('notes.file')}
                  openFolderLabel={t('notes.folder')}
                  recentNotesRoots={recentEmptyWorkspaceNotesRoots}
                  onOpenFile={handleOpenMarkdownFile}
                  onOpenFolder={handleOpenFolder}
                  onOpenRecentNotesRoot={handleOpenRecentNotesRoot}
                />
              ) : shouldShowOutlineEmpty ? (
                <NotesSidebarPillEmptyHint
                  title={t('notes.outlineEmpty')}
                />
              ) : null}
            </div>
          </div>
        </NotesSidebarScrollArea>
      </SidebarCapsulePanel>
    </div>
  );
}
