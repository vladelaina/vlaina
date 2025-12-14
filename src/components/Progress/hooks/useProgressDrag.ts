import { useState, useCallback } from 'react';
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/core';
// 移除了对 ProgressOrCounter 的导入，因为 items 参数被移除了
// import type { ProgressOrCounter } from '../../../stores/useProgressStore';

interface UseProgressDragOptions {
  // 移除了 items: ProgressOrCounter[];
  onReorder: (activeId: string, overId: string) => void;
}

/**
 * Hook for managing drag and drop state
 */
export function useProgressDrag({ onReorder }: UseProgressDragOptions) { // 移除了 items 参数
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragMove = useCallback(() => { // 移除了 event 参数
    // No-op for now, purely state driven
  }, []);

  const handleDragOver = useCallback((event: DragMoveEvent) => {
    setOverId(event.over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setOverId(null);

    if (over && active.id !== over.id) {
      onReorder(active.id as string, over.id as string);
    }
  }, [onReorder]);

  return {
    activeId,
    overId,
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDragEnd,
  };
}
