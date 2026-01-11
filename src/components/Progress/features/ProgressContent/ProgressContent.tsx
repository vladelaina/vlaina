import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, pointerWithin, PointerSensor, useSensor, useSensors, DragOverlay, MeasuringStrategy } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Archive, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressStore } from '@/stores/useProgressStore';
import { useProgressDrag } from '../../hooks/useProgressDrag';
import { useDayChange } from '@/hooks/useDayChange';
import { ItemCard, ActiveItemCard, ArchivedItemCard } from '../ItemCard';
import { CreateModal } from '../CreateModal';
import { DetailModal } from '../DetailModal';

interface ProgressContentProps {
  compact?: boolean;
}

export function ProgressContent({ compact = false }: ProgressContentProps) {
  useDayChange();
  const { items, addProgress, addCounter, updateCurrent, deleteItem, updateItem, loadItems, reorderItems } = useProgressStore();
  const [isArchiveView, setIsArchiveView] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { loadItems(); }, [loadItems]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewOverride, setPreviewOverride] = useState<{ icon?: string; title?: string } | null>(null);
  const [isStatusHovered, setIsStatusHovered] = useState(false);
  const selectedItem = items.find(i => i.id === selectedId) || null;
  const visibleItems = items.filter(item => isArchiveView ? item.archived : !item.archived);
  const archivedCount = items.filter(i => i.archived).length;
  const handleAutoArchive = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      const updates: Record<string, unknown> = { archived: !item.archived };
      if (item.archived && item.type === 'progress' && item.current >= (item.total || 0)) updates.current = 0;
      if (isArchiveView && item.archived && archivedCount === 1) setIsArchiveView(false);
      if (!item.archived) { setIsStatusHovered(true); setTimeout(() => setIsStatusHovered(false), 800); }
      updateItem(id, updates);
    }
  };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { activeId, handleDragStart, handleDragMove, handleDragOver, handleDragEnd } = useProgressDrag({ onReorder: reorderItems });
  const onDragStart = (event: any) => { handleDragStart(event); const node = document.getElementById('sortable-item-' + event.active.id); if (node) setDragWidth(node.offsetWidth); };
  const handleCreateProgress = (data: { title: string; icon?: string; direction: 'increment' | 'decrement'; total: number; step: number; unit: string }) => { addProgress(data); };
  const handleCreateCounter = (data: { title: string; icon?: string; step: number; unit: string; frequency: 'daily' | 'weekly' | 'monthly' }) => { addCounter(data); };
  const now = new Date();
  const day = now.getDate();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const pendingCount = items.filter(i => { if (i.archived) return false; if (i.type === 'progress') return i.current < (i.total || 0); return true; }).length;
  const greeting = pendingCount === 0 ? 'All Done' : pendingCount + ' Pending';
  const handlePreviewChange = useCallback((icon?: string, title?: string) => { if (icon === undefined && title === undefined) { setPreviewOverride(null); } else { setPreviewOverride(prev => { if (prev?.icon === icon && prev?.title === title) return prev; return { icon, title }; }); } }, []);
  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <AnimatePresence>
        {!isArchiveView && (
          <motion.div className={'absolute top-3 z-40 pointer-events-none flex items-center gap-3 ' + (compact ? 'right-3' : 'right-6')} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
            <motion.button layout onClick={() => setShowCreateModal(true)} className="pointer-events-auto group flex items-center justify-center w-8 h-8 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-sm hover:shadow-md text-zinc-600 dark:text-zinc-300">
              <Plus className="size-4" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={scrollRef} className={'flex-1 overflow-y-auto py-3 ' + (compact ? 'px-3' : 'px-6')}>
        <div className={'relative mb-3 select-none ' + (compact ? 'min-h-[40px]' : 'min-h-[50px]')}>
          <motion.div key={isArchiveView ? 'archive' : 'normal'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative">
            {!isArchiveView ? (
              <>
                {!compact && <div className="absolute -top-6 -left-4 text-[5rem] leading-none font-thin text-zinc-50 dark:text-zinc-800/30 select-none pointer-events-none tracking-tighter">{day}</div>}
                <div className="relative z-10 flex flex-col gap-0">
                  <div onClick={() => setIsArchiveView(true)} className="flex items-center gap-1.5 mb-0.5 cursor-pointer">
                    <motion.div onMouseEnter={() => setIsStatusHovered(true)} onMouseLeave={() => setIsStatusHovered(false)} className="group/status relative flex items-center justify-start h-4 overflow-hidden">
                      <AnimatePresence mode="wait" initial={false}>
                        {isStatusHovered ? (
                          <motion.div key="archive-hint" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                            <Archive className="size-3" /><span className="text-[9px] font-bold tracking-[0.2em] uppercase">HISTORY</span>
                          </motion.div>
                        ) : (
                          <motion.div key="status-text" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}>
                            <span className="text-[9px] font-bold tracking-[0.2em] text-zinc-400 dark:text-zinc-500 uppercase">{greeting.toUpperCase()}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                  <h1 className={'font-serif italic font-light text-zinc-800 dark:text-zinc-100 tracking-tight ' + (compact ? 'text-lg' : 'text-2xl')}>{compact ? greeting : weekday}</h1>
                </div>
              </>
            ) : (
              <div className="relative z-10 flex items-center gap-2">
                <button onClick={() => setIsArchiveView(false)} className="group flex items-center justify-center p-1 -ml-1"><ArrowLeft className="size-4 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors" /></button>
                <h1 className={'font-serif italic font-light text-zinc-800 dark:text-zinc-100 tracking-tight ' + (compact ? 'text-lg' : 'text-2xl')}>Archived</h1>
                <span className="text-xs text-zinc-300 dark:text-zinc-600 font-serif italic">{archivedCount}</span>
              </div>
            )}
          </motion.div>
        </div>
        <div className={compact ? 'pb-3' : 'px-6 pb-4'}>
          {visibleItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 opacity-50">
              <div className={'rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 ' + (compact ? 'w-12 h-12' : 'w-16 h-16')}>
                {isArchiveView ? <Archive className={'text-zinc-300 dark:text-zinc-600 ' + (compact ? 'size-6' : 'size-8')} /> : <Plus className={'text-zinc-300 dark:text-zinc-600 ' + (compact ? 'size-6' : 'size-8')} />}
              </div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">{isArchiveView ? 'No archived items' : 'No progress items'}</p>
            </div>
          )}
          <DndContext sensors={sensors} collisionDetection={pointerWithin} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} onDragStart={onDragStart} onDragMove={handleDragMove} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className={compact ? 'space-y-2' : 'space-y-3'}>
                {visibleItems.map((item) => (
                  <div key={item.id} id={'sortable-item-' + item.id}>
                    <ItemCard item={item} onUpdate={updateCurrent} onClick={() => setSelectedId(item.id)} onAutoArchive={handleAutoArchive} onDelete={deleteItem} isDragging={activeId === item.id} previewIcon={selectedItem?.id === item.id ? previewOverride?.icon : undefined} previewTitle={selectedItem?.id === item.id ? previewOverride?.title : undefined} compact={compact} />
                  </div>
                ))}
              </div>
            </SortableContext>
            {createPortal(<DragOverlay dropAnimation={null} className="cursor-grabbing" style={{ zIndex: 999999 }}>{activeId ? (() => { const item = items.find(i => i.id === activeId); if (!item) return null; return (<div className="w-full" style={{ width: dragWidth ? dragWidth + 'px' : '100%' }}>{item.archived ? <ArchivedItemCard item={item} onUpdate={updateCurrent} onClick={() => {}} onAutoArchive={handleAutoArchive} onDelete={deleteItem} isDragging={true} compact={compact} /> : <ActiveItemCard item={item} onUpdate={updateCurrent} onClick={() => {}} onAutoArchive={handleAutoArchive} isDragging={true} compact={compact} />}</div>); })() : null}</DragOverlay>, document.body)}
          </DndContext>
        </div>
      </div>
      <CreateModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onCreateProgress={handleCreateProgress} onCreateCounter={handleCreateCounter} />
      <DetailModal item={selectedItem} onClose={() => setSelectedId(null)} onUpdate={updateItem} onDelete={deleteItem} onPreviewChange={handlePreviewChange} />
    </div>
  );
}

