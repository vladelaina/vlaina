import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  getSidebarLabelClass,
  getSidebarSoftTextClass,
} from '@/components/layout/sidebar/sidebarLabelStyles';
import { useNotesOutline } from './useNotesOutline';
import { CollapseTriangleAffordance } from '../../common/collapseTrianglePrimitive';
import {
  NotesSidebarHoverEmptyHint,
  NotesSidebarScrollArea,
} from '../NotesSidebarPrimitives';
import { NotesSidebarRow } from '../NotesSidebarRow';
import { NotesSidebarTopActions } from '../NotesSidebarTopActions';
import { useHeldPageScroll } from '@/hooks/useHeldPageScroll';
import {
  buildOutlineTree,
  cleanupCollapsedHeadingIds,
  toggleCollapsedHeadingId,
  type OutlineTreeNode,
} from './outlineCollapseTree';

interface NotesOutlineProps {
  enabled: boolean;
  className?: string;
  isPeeking?: boolean;
}

export function NotesOutline({ enabled, className, isPeeking = false }: NotesOutlineProps) {
  const { headings, activeId, jumpToHeading } = useNotesOutline(enabled);
  const [collapsedHeadingIds, setCollapsedHeadingIds] = useState<Set<string>>(() => new Set());
  const sidebarRootRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);

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
            onClick={() => jumpToHeading(node.id)}
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
                  getSidebarSoftTextClass('notes'),
                  'hover:text-[var(--notes-sidebar-text)]',
                )}
              >
                <CollapseTriangleAffordance
                  collapsed={isCollapsed}
                  visibility="hover-unless-collapsed"
                  size={12}
                />
              </button>
            ) : (
              <span className="inline-flex size-4 shrink-0" aria-hidden="true" />
            )}
            main={
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  jumpToHeading(node.id);
                }}
                className={cn(
                  'block w-full min-w-0 cursor-pointer truncate text-left',
                  getSidebarLabelClass('notes', { selected: isActive }),
                )}
              >
                {node.text}
              </button>
            }
          />
          {hasChildren && !isCollapsed ? renderTreeNodes(node.children) : null}
        </div>
      );
    });
  }, [activeId, collapsedHeadingIds, jumpToHeading, toggleOutlineNode]);

  return (
    <div ref={sidebarRootRef} className={cn('flex h-full flex-col', className)}>
      <NotesSidebarTopActions />
      <NotesSidebarScrollArea
        ref={scrollRootRef}
        className={cn(isPeeking ? 'vlaina-scrollbar-rounded pt-4 pb-4' : 'pt-2')}
        data-notes-sidebar-scroll-root="true"
      >
        <div className="relative min-h-full">
          {headings.length > 0 ? (
            <nav aria-label="Document outline" className="space-y-0.5">
              {renderTreeNodes(headingTree)}
            </nav>
          ) : null}
          {headings.length === 0 ? (
            <NotesSidebarHoverEmptyHint title="Outline is empty" />
          ) : null}
        </div>
      </NotesSidebarScrollArea>
    </div>
  );
}
