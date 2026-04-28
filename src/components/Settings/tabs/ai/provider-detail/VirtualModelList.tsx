import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

const MODEL_ROW_SLOT_HEIGHT = 58;

export function VirtualModelList<T>({
  items,
  resetKey,
  scrollRef,
  getKey,
  renderItem,
  emptyState,
}: {
  items: T[];
  resetKey: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  emptyState: ReactNode;
}) {
  const innerScrollRef = useRef<HTMLDivElement | null>(null);
  const resolvedScrollRef = scrollRef ?? innerScrollRef;
  const itemKeys = useMemo(
    () => items.map((item) => getKey(item)).join('\u0000'),
    [getKey, items],
  );
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => resolvedScrollRef.current,
    estimateSize: () => MODEL_ROW_SLOT_HEIGHT,
    overscan: 6,
  });

  useEffect(() => {
    resolvedScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [resetKey, resolvedScrollRef]);

  useEffect(() => {
    virtualizer.measure();
  }, [itemKeys, virtualizer]);

  if (items.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-zinc-200/90 px-3.5 py-6 text-center text-[12px] text-zinc-400">
        {emptyState}
      </div>
    );
  }

  return (
    <div
      ref={resolvedScrollRef}
      className="max-h-[420px] overflow-y-auto pr-1 vlaina-scrollbar"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) return null;

          return (
            <div
              key={getKey(item)}
              style={{
                height: `${virtualRow.size}px`,
                left: 0,
                position: 'absolute',
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
                width: '100%',
              }}
            >
              <div className="pb-2">
                {renderItem(item)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
