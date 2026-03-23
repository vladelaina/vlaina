import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useNotesOutline } from './useNotesOutline';
import { CollapseTriangleAffordance } from '../../common/collapseTrianglePrimitive';
import { NotesSidebarScrollArea } from '../NotesSidebarPrimitives';
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
          <div
            className={cn(
              'group flex items-center rounded-md transition-colors',
              'hover:bg-[var(--neko-hover-filled)]',
              isActive
                ? 'bg-[var(--neko-hover-filled)] text-[var(--neko-text-primary)]'
                : 'text-[var(--neko-text-secondary)]',
            )}
            style={{ paddingLeft: `${8 + (node.level - 1) * 12}px`, paddingRight: '8px' }}
          >
            {hasChildren ? (
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
                className="mr-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-secondary)]"
              >
              <CollapseTriangleAffordance
                collapsed={isCollapsed}
                visibility="hover-unless-collapsed"
                size={12}
              />
              </button>
            ) : (
              <span className="mr-1 inline-flex h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={() => jumpToHeading(node.id)}
              className="min-w-0 flex-1 py-1.5 text-left text-[13px] leading-5 whitespace-normal break-words"
            >
              {node.text}
            </button>
          </div>
          {hasChildren && !isCollapsed ? renderTreeNodes(node.children) : null}
        </div>
      );
    });
  }, [activeId, collapsedHeadingIds, jumpToHeading, toggleOutlineNode]);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <NotesSidebarScrollArea
        className={cn(isPeeking ? 'neko-scrollbar-rounded pt-4 pb-4' : 'pt-2')}
        data-notes-sidebar-scroll-root="true"
      >
        {headings.length === 0 ? (
          <div className="px-2 py-3 text-[12px] text-[var(--neko-text-tertiary)]">
            No headings in this note
          </div>
        ) : (
          <nav aria-label="Document outline" className="space-y-0.5">
            {renderTreeNodes(headingTree)}
          </nav>
        )}
      </NotesSidebarScrollArea>
    </div>
  );
}
