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
      {/* Right: Levitating Lens Button (Always Floating) */}
      <div className="absolute top-5 right-6 z-30 pointer-events-none">
        <button
           onClick={openCreateModal}
           className="
             pointer-events-auto
             group flex items-center gap-2 pl-2 pr-4 py-2 rounded-full 
             bg-white/60 hover:bg-white/90 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/90
             backdrop-blur-xl shadow-sm hover:shadow-md
             border border-white/20 dark:border-white/5
             transition-all duration-300
             text-sm font-medium text-zinc-600 dark:text-zinc-300
           "
         >
            <div className="bg-zinc-900 dark:bg-zinc-100 p-1 rounded-full group-hover:scale-110 transition-transform duration-300">
              <Plus className="size-3 text-white dark:text-zinc-900" strokeWidth={2.5} />
            </div>
            <span className="tracking-wide text-xs uppercase font-bold opacity-90">New</span>
         </button>
      </div>

      {/* Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Header Section inside ScrollView */}
        <div className="px-6 pt-6 pb-6 flex items-center justify-between">
           {/* Left: Time Anchor (Scrolls with content) */}
           <div className="text-[10px] font-bold text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.2em] select-none py-2">
             {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
           </div>
        </div>

        <div className="px-6 pb-4">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <Plus className="size-8 text-zinc-300 dark:text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 font-medium">Start tracking your first habit</p>
            </div>
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
