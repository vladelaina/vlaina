import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { FileTreeNode } from '@/stores/useNotesStore';
import { FileTreeItem } from './FileTreeItem';
import {
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

  const virtualWindow = getVirtualFileTreeWindow({
    rowCount: rows.length,
    rowHeight: VIRTUAL_FILE_TREE_ROW_HEIGHT,
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
