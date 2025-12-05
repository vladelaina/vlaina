import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useProgressStore, type ProgressOrCounter } from '@/stores/useProgressStore';
import { useProgressDrag } from './hooks/useProgressDrag';
import { ItemCard } from './ItemCard';
import { CreateModal } from './CreateModal';
import { DetailModal } from './DetailModal';


/**
 * Progress tracking page with list view and creation modal
 */
export function ProgressPage() {
  const { items, addProgress, addCounter, updateCurrent, deleteItem, updateItem, loadItems, reorderItems } = useProgressStore();

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ProgressOrCounter | null>(null);
  const [previewOverride, setPreviewOverride] = useState<{ icon?: string; title?: string } | null>(null);

  // Drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const {
    activeId,
    overId,
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDragEnd,
  } = useProgressDrag({ items, onReorder: reorderItems });

  // Handle opening create modal
  const openCreateModal = () => {
    setShowCreateModal(true);
  };

  // Handle form submissions
  const handleCreateProgress = (data: {
    title: string;
    icon?: string;
    direction: 'increment' | 'decrement';
    total: number;
    step: number;
    unit: string;
  }) => {
    addProgress({
      title: data.title,
      icon: data.icon,
      direction: data.direction,
      total: data.total,
      step: data.step,
      unit: data.unit,
    });
  };

  const handleCreateCounter = (data: {
    title: string;
    icon?: string;
    step: number;
    unit: string;
    frequency: 'daily' | 'weekly' | 'monthly';
  }) => {
    addCounter(data);
  };

  // Main list view
  return (
    <div className="h-full bg-white dark:bg-zinc-900 flex flex-col relative">
      {/* Add button */}
      <button
        onClick={openCreateModal}
        className="absolute top-3 right-5 p-1 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors z-10"
      >
        <Plus className="size-4" />
      </button>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 pt-10">
        {items.length === 0 && (
          <p className="text-sm text-zinc-300 dark:text-zinc-600 text-center py-12">暂无进度项目</p>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {items.map((item) => {
                const isDropTarget = item.id === overId && overId !== activeId;
                const activeIndex = activeId ? items.findIndex(i => i.id === activeId) : -1;
                const overIndex = overId ? items.findIndex(i => i.id === overId) : -1;
                const insertAfter = isDropTarget && activeIndex !== -1 && overIndex > activeIndex;

                return (
                  <div key={item.id}>
                    {!insertAfter && isDropTarget && (
                      <div className="h-20 rounded-md border-2 border-dashed border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/50 mb-3" />
                    )}
                    <ItemCard
                      item={item}
                      onUpdate={updateCurrent}
                      onClick={() => setSelectedItem(item)}
                      isDragging={activeId === item.id}
                      previewIcon={selectedItem?.id === item.id ? previewOverride?.icon : undefined}
                      previewTitle={selectedItem?.id === item.id ? previewOverride?.title : undefined}
                    />
                    {insertAfter && isDropTarget && (
                      <div className="h-20 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/50 mt-3" />
                    )}
                  </div>
                );
              })}
            </div>
          </SortableContext>
          <DragOverlay>
            {/* Empty overlay - only show Rust window */}
            {null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Create Modal */}
      <CreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateProgress={handleCreateProgress}
        onCreateCounter={handleCreateCounter}
      />

      {/* Detail Modal */}
      <DetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onPreviewChange={(icon, title) => {
          if (icon === undefined && title === undefined) {
            setPreviewOverride(null);
          } else {
            setPreviewOverride({ icon, title });
          }
        }}
      />
    </div>
  );
}
