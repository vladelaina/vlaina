import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { FileTreeNode } from '@/stores/useNotesStore';
import { FileTreeItem } from './FileTreeItem';
import {
  SIDEBAR_SCROLL_TO_PATH_EVENT,
  type SidebarScrollToPathDetail,
} from '../common/sidebarScrollIntoView';
import {
  buildVirtualFileTreeRowOffsets,
  estimateVirtualFileTreeRowHeight,
  flattenVisibleFileTreeRows,
  getVirtualFileTreeWindow,
  VIRTUAL_FILE_TREE_MIN_ROWS,
  VIRTUAL_FILE_TREE_OVERSCAN_ROWS,
  VIRTUAL_FILE_TREE_ROW_HEIGHT,
} from './virtualFileTree';

interface VirtualizedFileTreeProps {
  nodes: FileTreeNode[];
  startDepth: number;
  scrollRootRef: RefObject<HTMLElement | null>;
  parentFolderPath?: string;
}

export function shouldVirtualizeFileTree(rowCount: number) {
  return rowCount >= VIRTUAL_FILE_TREE_MIN_ROWS;
}

export function VirtualizedFileTree({
  nodes,
  startDepth,
  scrollRootRef,
  parentFolderPath = '',
}: VirtualizedFileTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportFrameRef = useRef<number | null>(null);
  const rows = useMemo(
    () => flattenVisibleFileTreeRows(nodes, startDepth, parentFolderPath),
    [nodes, parentFolderPath, startDepth],
  );
  const rowHeights = useMemo(() => rows.map(estimateVirtualFileTreeRowHeight), [rows]);
  const rowOffsets = useMemo(() => buildVirtualFileTreeRowOffsets(rowHeights), [rowHeights]);
  const [viewport, setViewport] = useState({ start: 0, height: 0 });

  const updateViewport = useCallback(() => {
    if (viewportFrameRef.current !== null) {
      return;
    }

    viewportFrameRef.current = window.requestAnimationFrame(() => {
      viewportFrameRef.current = null;
      const scrollRoot = scrollRootRef.current;
      const container = containerRef.current;
      if (!scrollRoot || !container) {
        return;
      }

      const scrollRootRect = scrollRoot.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const containerTopInScroll = containerRect.top - scrollRootRect.top + scrollRoot.scrollTop;
      setViewport({
        start: scrollRoot.scrollTop - containerTopInScroll,
        height: scrollRoot.clientHeight,
      });
    });
  }, [scrollRootRef]);

  const updateViewportNow = useCallback(() => {
    if (viewportFrameRef.current !== null) {
      window.cancelAnimationFrame(viewportFrameRef.current);
      viewportFrameRef.current = null;
    }

    const scrollRoot = scrollRootRef.current;
    const container = containerRef.current;
    if (!scrollRoot || !container) {
      return;
    }

    const scrollRootRect = scrollRoot.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const containerTopInScroll = containerRect.top - scrollRootRect.top + scrollRoot.scrollTop;
    setViewport({
      start: scrollRoot.scrollTop - containerTopInScroll,
      height: scrollRoot.clientHeight,
    });
  }, [scrollRootRef]);

  useLayoutEffect(() => {
    updateViewportNow();

    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) {
      return;
    }

    scrollRoot.addEventListener('scroll', updateViewport, { passive: true });
    window.addEventListener('resize', updateViewport);

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateViewport);
    resizeObserver?.observe(scrollRoot);

    return () => {
      if (viewportFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportFrameRef.current);
        viewportFrameRef.current = null;
      }
      scrollRoot.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
      resizeObserver?.disconnect();
    };
  }, [scrollRootRef, updateViewport, updateViewportNow]);

  useLayoutEffect(() => {
    const scrollRoot = scrollRootRef.current;
    const container = containerRef.current;
    if (!scrollRoot || !container) {
      return;
    }

    const handleScrollToPath = (event: Event) => {
      const customEvent = event as CustomEvent<SidebarScrollToPathDetail>;
      const targetPath = customEvent.detail?.path;
      if (!targetPath) {
        return;
      }

      const rowIndex = rows.findIndex((row) => row.node.path === targetPath);
      if (rowIndex === -1) {
        return;
      }

      event.preventDefault();

      const scrollRootRect = scrollRoot.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const containerTopInScroll = containerRect.top - scrollRootRect.top + scrollRoot.scrollTop;
      const targetTop = containerTopInScroll + (rowOffsets[rowIndex] ?? 0);
      const targetHeight = rowHeights[rowIndex] ?? VIRTUAL_FILE_TREE_ROW_HEIGHT;
      const block = customEvent.detail.block;
      const maxScrollTop = Math.max(scrollRoot.scrollHeight - scrollRoot.clientHeight, 0);
      const nextScrollTop = (() => {
        if (block === 'start') {
          return targetTop;
        }
        if (block === 'end') {
          return targetTop - scrollRoot.clientHeight + targetHeight;
        }
        if (block === 'nearest') {
          if (targetTop >= scrollRoot.scrollTop && targetTop + targetHeight <= scrollRoot.scrollTop + scrollRoot.clientHeight) {
            return scrollRoot.scrollTop;
          }
          if (targetTop < scrollRoot.scrollTop) {
            return targetTop;
          }
          return targetTop - scrollRoot.clientHeight + targetHeight;
        }
        return targetTop - Math.max(0, (scrollRoot.clientHeight - targetHeight) / 2);
      })();

      scrollRoot.scrollTo({
        top: Math.max(0, Math.min(maxScrollTop, nextScrollTop)),
        behavior: 'auto',
      });
      updateViewport();
    };

    scrollRoot.addEventListener(SIDEBAR_SCROLL_TO_PATH_EVENT, handleScrollToPath);
    return () => {
      scrollRoot.removeEventListener(SIDEBAR_SCROLL_TO_PATH_EVENT, handleScrollToPath);
    };
  }, [rowHeights, rowOffsets, rows, scrollRootRef, updateViewport]);

  const virtualWindow = getVirtualFileTreeWindow({
    rowCount: rows.length,
    rowHeight: VIRTUAL_FILE_TREE_ROW_HEIGHT,
    rowHeights,
    rowOffsets,
    viewportStart: viewport.start,
    viewportHeight: viewport.height,
    overscanRows: VIRTUAL_FILE_TREE_OVERSCAN_ROWS,
  });
  const visibleRows = rows.slice(virtualWindow.startIndex, virtualWindow.endIndex);

  return (
    <div ref={containerRef} style={{ height: virtualWindow.totalHeight }} className="relative">
      <div
        className="absolute inset-x-0 top-0"
        style={{ transform: `translateY(${virtualWindow.offsetTop}px)` }}
      >
        {visibleRows.map((row) => (
          <FileTreeItem
            key={row.node.id}
            node={row.node}
            depth={row.depth}
            parentFolderPath={row.parentFolderPath}
            renderChildren={false}
          />
        ))}
      </div>
    </div>
  );
}
