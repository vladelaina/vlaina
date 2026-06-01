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
      <div className="rounded-[var(--vlaina-radius-18px)] border border-dashed border-[var(--vlaina-border)] px-3.5 py-6 text-center text-[var(--vlaina-font-xs)] text-[var(--vlaina-sidebar-notes-text-soft)]">
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
