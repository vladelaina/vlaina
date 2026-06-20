import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { useNotesStore } from '@/stores/useNotesStore';
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
import {
  NotesSidebarHoverEmptyHint,
  NotesSidebarPillEmptyHint,
  NotesSidebarScrollArea,
} from '../NotesSidebarPrimitives';
import { NotesSidebarRow } from '../NotesSidebarRow';
import { NotesSidebarTopActions } from '../NotesSidebarTopActions';
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
  const hasStarredEntries = useNotesStore((s) => s.starredEntries.length > 0);
  const starredLoaded = useNotesStore((s) => s.starredLoaded);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const [collapsedHeadingIds, setCollapsedHeadingIds] = useState<Set<string>>(() => new Set());
  const [renamingHeadingId, setRenamingHeadingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const sidebarRootRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const hasCurrentFile = Boolean(currentNotePath && !isDraftNotePath(currentNotePath));
  const shouldShowOpenTargetActions = starredLoaded && !hasStarredEntries && !hasCurrentFile;

  useHeldPageScroll(scrollRootRef, {
    scopeRef: sidebarRootRef,
    ignoreEditableTargets: true,
  });

  const headingTree = useMemo(() => buildOutlineTree(headings), [headings]);

  useEffect(() => {
    setCollapsedHeadingIds((previous) => {
      const next = cleanupCollapsedHeadingIds(previous, headings);
      if (next.size === previous.size && Array.from(next).every((id) => previous.has(id))) return previous;
      return next;
    });
  }, [headings]);

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

  const renderTreeNodes = useCallback((nodes: readonly OutlineTreeNode[]) => {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isCollapsed = hasChildren && collapsedHeadingIds.has(node.id);
      const isActive = node.id === activeId;

      return (
        <div key={node.id}>
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
          {hasChildren && !isCollapsed ? renderTreeNodes(node.children) : null}
        </div>
      );
    });
  }, [
    activeId,
    collapsedHeadingIds,
    renameValue,
    renamingHeadingId,
    scheduleJumpToHeading,
    startRenameHeading,
    submitRenameHeading,
    toggleOutlineNode,
  ]);

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
                {renderTreeNodes(headingTree)}
              </nav>
            ) : null}
            <div
              data-notes-sidebar-blank-drag-root="true"
              className={cn('flex flex-1 items-center justify-center', headings.length === 0 && 'min-h-[var(--vlaina-size-160px)] pb-8')}
            >
              {headings.length === 0 ? (
                <NotesSidebarPillEmptyHint
                  title={t('notes.outlineEmpty')}
                />
              ) : null}
            </div>
          </div>
        </NotesSidebarScrollArea>
      </SidebarCapsulePanel>
      {headings.length === 0 && shouldShowOpenTargetActions && !sidebarCollapsed ? (
        <div className="pointer-events-none fixed bottom-5 left-4 z-[var(--vlaina-z-50)] flex w-[var(--vlaina-width-sidebar-content-inner)] justify-center">
          <NotesSidebarHoverEmptyHint
            actions={[
              { label: t('notes.file'), onAction: handleOpenMarkdownFile },
              { label: t('notes.folder'), onAction: handleOpenFolder },
            ]}
            placement="inline"
            visible
          />
        </div>
      ) : null}
    </div>
  );
}
