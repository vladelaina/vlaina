import type { ReactNode } from 'react';

export function VirtualModelList<T>({
  items,
  getKey,
  renderItem,
  emptyState,
}: {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  emptyState: ReactNode;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-zinc-200/90 px-3.5 py-6 text-center text-[12px] text-zinc-400">
        {emptyState}
      </div>
    );
  }

  return (
    <div>
      {items.map((item) => (
        <div key={getKey(item)} className="pb-2">
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}
