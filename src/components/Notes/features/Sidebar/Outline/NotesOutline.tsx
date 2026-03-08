import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useNotesOutline } from './useNotesOutline';
import { COLLAPSE_TRIANGLE_PATH, COLLAPSE_TRIANGLE_VIEW_BOX } from '../../common/collapseTriangle';
import {
  buildOutlineTree,
  cleanupCollapsedHeadingIds,
  toggleCollapsedHeadingId,
  type OutlineTreeNode,
} from './outlineCollapseTree';

interface NotesOutlineProps {
  enabled: boolean;
  className?: string;
}

export function NotesOutline({ enabled, className }: NotesOutlineProps) {
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
                className={cn(
                  'mr-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[var(--neko-text-tertiary)] transition-opacity duration-150 hover:text-[var(--neko-text-secondary)]',
                  isCollapsed ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox={COLLAPSE_TRIANGLE_VIEW_BOX}
                  fill="currentColor"
                  className={cn('transition-transform duration-150', isCollapsed && '-rotate-90')}
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d={COLLAPSE_TRIANGLE_PATH} />
                </svg>
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
      <div
        className="flex-1 overflow-auto neko-scrollbar px-2 pb-4 pt-2"
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
      </div>
    </div>
  );
}
