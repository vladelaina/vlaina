import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { useUIStore } from '@/stores/uiSlice';
import {
  getSidebarLabelClass,
  SIDEBAR_LABEL_TEXT_METRICS_CLASS,
} from '@/components/layout/sidebar/sidebarLabelStyles';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import { useNotesOutline } from './useNotesOutline';
import {
  CollapseTriangleAffordance,
  getSidebarCollapseTriangleColorClassName,
} from '../../common/collapseTrianglePrimitive';
import { NotesSidebarPillEmptyHint, NotesSidebarScrollArea } from '../NotesSidebarPrimitives';
import { NotesSidebarRow } from '../NotesSidebarRow';
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
import {
  buildOutlineTree,
  cleanupCollapsedHeadingIds,
  toggleCollapsedHeadingId,
  type OutlineTreeNode,
} from './outlineCollapseTree';
import { themeIconTokens } from '@/styles/themeTokens';

const OUTLINE_VIRTUALIZATION_THRESHOLD = 160;
const OUTLINE_ESTIMATED_ROW_HEIGHT = 38;
const OUTLINE_VIRTUAL_OVERSCAN_ROWS = 8;

interface NotesOutlineProps {
  enabled: boolean;
  currentNotePath?: string | null;
  className?: string;
  isPeeking?: boolean;
}

interface VisibleOutlineRow {
  node: OutlineTreeNode;
  hasChildren: boolean;
  isCollapsed: boolean;
}

function flattenVisibleOutlineRows(
  nodes: readonly OutlineTreeNode[],
  collapsedHeadingIds: ReadonlySet<string>,
): VisibleOutlineRow[] {
  const rows: VisibleOutlineRow[] = [];
  const stack = [...nodes].reverse();

  while (stack.length > 0) {
    const node = stack.pop()!;
    const hasChildren = node.children.length > 0;
    const isCollapsed = hasChildren && collapsedHeadingIds.has(node.id);
    rows.push({ node, hasChildren, isCollapsed });

    if (!hasChildren || isCollapsed) {
      continue;
    }

    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      const child = node.children[index];
      if (child) {
        stack.push(child);
      }
    }
  }

  return rows;
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
  const [collapsedHeadingIds, setCollapsedHeadingIds] = useState<Set<string>>(() => new Set());
  const [renamingHeadingId, setRenamingHeadingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
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

  const headingTree = useMemo(() => buildOutlineTree(headings), [headings]);
  const visibleOutlineRows = useMemo(
    () => flattenVisibleOutlineRows(headingTree, collapsedHeadingIds),
    [collapsedHeadingIds, headingTree],
  );
  const shouldVirtualizeOutline = visibleOutlineRows.length >= OUTLINE_VIRTUALIZATION_THRESHOLD;
  const outlineVirtualizer = useVirtualizer({
    count: visibleOutlineRows.length,
    enabled: shouldVirtualizeOutline,
    getScrollElement: () => scrollRootRef.current,
    estimateSize: () => OUTLINE_ESTIMATED_ROW_HEIGHT,
    overscan: OUTLINE_VIRTUAL_OVERSCAN_ROWS,
  });

  useEffect(() => {
    setCollapsedHeadingIds((previous) => {
      const next = cleanupCollapsedHeadingIds(previous, headings);
      if (next.size === previous.size && Array.from(next).every((id) => previous.has(id))) return previous;
      return next;
    });
  }, [headings]);

  useEffect(() => {
    if (!shouldVirtualizeOutline) {
      return;
    }

    outlineVirtualizer.measure();
  }, [outlineVirtualizer, shouldVirtualizeOutline, visibleOutlineRows]);

  const toggleOutlineNode = useCallback((headingId: string) => {
    setCollapsedHeadingIds((previous) => toggleCollapsedHeadingId(previous, headingId));
  }, []);

  const scheduleJumpToHeading = useCallback((headingId: string) => {
    jumpToHeading(headingId);
  }, [jumpToHeading]);

  const startRenameHeading = useCallback((heading: OutlineTreeNode) => {
    setRenamingHeadingId(heading.id);
    setRenameValue(heading.text);
  }, []);

  const submitRenameHeading = useCallback((headingId: string) => {
    const renamed = renameHeading(headingId, renameValue);
    if (renamed) {
      setRenamingHeadingId(null);
      return;
    }

    const fallbackHeading = headings.find((heading) => heading.id === headingId);
    setRenameValue(fallbackHeading?.text ?? '');
    setRenamingHeadingId(null);
  }, [headings, renameHeading, renameValue]);

  const handleOpenMarkdownFile = useCallback(() => {
    window.dispatchEvent(new Event('app-open-markdown-target-file'));
  }, []);

  const handleOpenFolder = useCallback(() => {
    window.dispatchEvent(new Event('app-open-markdown-target-folder'));
  }, []);

  const handleOpenRecentNotesRoot = useCallback((path: string) => {
    void openNotesRoot(path).catch(() => undefined);
  }, [openNotesRoot]);

  const renderOutlineRow = useCallback(({ node, hasChildren, isCollapsed }: VisibleOutlineRow) => {
    const isActive = node.id === activeId;

    return (
      <NotesSidebarRow
        depth={node.level - 1}
        isActive={isActive}
        onClick={() => scheduleJumpToHeading(node.id)}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          startRenameHeading(node);
        }}
        rowClassName="items-center"
        leadingClassName="self-center"
        leading={hasChildren ? (
          <button
            type="button"
            aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
            aria-expanded={!isCollapsed}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggleOutlineNode(node.id);
            }}
            className={cn(
              'inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm',
            )}
          >
            <CollapseTriangleAffordance
              collapsed={isCollapsed}
              visibility="hover-unless-collapsed"
              size={themeIconTokens.sizeXs}
              className={cn(
                'transition-[color,opacity] duration-[var(--vlaina-duration-150)] group-hover/sidebar-row:opacity-[var(--vlaina-opacity-100)] group-focus-within/sidebar-row:opacity-[var(--vlaina-opacity-100)]',
                getSidebarCollapseTriangleColorClassName({
                  active: isActive,
                  soft: !isActive,
                  rowHover: true,
                }),
              )}
            />
          </button>
        ) : (
          <span className="inline-flex size-4 shrink-0" aria-hidden="true" />
        )}
        main={
          renamingHeadingId === node.id ? (
            <SidebarInlineRenameInput
              value={renameValue}
              onValueChange={setRenameValue}
              onSubmit={() => submitRenameHeading(node.id)}
              onCancel={() => setRenamingHeadingId(null)}
              className={cn(
                'w-full min-w-0 border-none bg-transparent p-0 outline-none text-left',
                SIDEBAR_LABEL_TEXT_METRICS_CLASS,
                getSidebarLabelClass('notes', { selected: isActive }),
              )}
            />
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                scheduleJumpToHeading(node.id);
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                startRenameHeading(node);
              }}
              className={cn(
                'block w-full min-w-0 cursor-pointer whitespace-normal break-words py-1 text-left [overflow-wrap:anywhere]',
                SIDEBAR_LABEL_TEXT_METRICS_CLASS,
                getSidebarLabelClass('notes', { selected: isActive }),
              )}
            >
              {node.text}
            </button>
          )
        }
      />
    );
  }, [
    activeId,
    renameValue,
    renamingHeadingId,
    scheduleJumpToHeading,
    startRenameHeading,
    submitRenameHeading,
    toggleOutlineNode,
  ]);

  const renderOutlineRows = () => {
    if (!shouldVirtualizeOutline) {
      return visibleOutlineRows.map((row) => (
        <div key={row.node.id}>
          {renderOutlineRow(row)}
        </div>
      ));
    }

    return (
      <div
        style={{
          height: `${outlineVirtualizer.getTotalSize()}px`,
          position: 'relative',
          width: '100%',
        }}
      >
        {outlineVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = visibleOutlineRows[virtualRow.index];
          if (!row) {
            return null;
          }

          return (
            <div
              key={row.node.id}
              data-index={virtualRow.index}
              ref={outlineVirtualizer.measureElement}
              style={{
                left: 0,
                position: 'absolute',
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
                width: '100%',
              }}
            >
              {renderOutlineRow(row)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div ref={sidebarRootRef} className={cn('flex h-full min-h-0 flex-col', className)}>
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
                {renderOutlineRows()}
              </nav>
            ) : null}
            <div
              data-notes-sidebar-blank-drag-root="true"
              className={cn('flex flex-1 items-center justify-center', headings.length === 0 && 'min-h-[var(--vlaina-size-160px)] pb-8')}
            >
              {shouldShowEmptyWorkspacePanel ? (
                <SidebarEmptyWorkspacePanel
                  folderLabel={t('notes.folder')}
                  openFileLabel={t('notes.openFile')}
                  openFolderLabel={t('notes.openFolder')}
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
