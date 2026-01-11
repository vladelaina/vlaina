import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  MeasuringStrategy,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Archive, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressStore } from '@/stores/useProgressStore';
import { useProgressDrag } from './hooks/useProgressDrag';
import { useDayChange } from '@/hooks/useDayChange';
import { ItemCard, ActiveItemCard, ArchivedItemCard } from './features/ItemCard';
import { CreateModal } from './features/CreateModal';
import { DetailModal } from './features/DetailModal';


export function ProgressPage() {
  useDayChange();

  const { items, addProgress, addCounter, updateCurrent, deleteItem, updateItem, loadItems, reorderItems } = useProgressStore();
  
  const [isScrolled, setIsScrolled] = useState(false);
  const [isArchiveView, setIsArchiveView] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (scrollRef.current) {
      setIsScrolled(scrollRef.current.scrollTop > 20);
    }
  };

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleAutoArchive = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      const updates: any = { archived: !item.archived };
      
      if (item.archived && item.type === 'progress' && item.current >= item.total) {
         updates.current = 0;
      }

      if (isArchiveView && item.archived && archivedCount === 1) {
        setIsArchiveView(false);
      }

      if (!item.archived) {
        setIsStatusHovered(true);
        setTimeout(() => setIsStatusHovered(false), 800);
      }

      updateItem(id, updates);
    }
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewOverride, setPreviewOverride] = useState<{ icon?: string; title?: string } | null>(null);
  const [isStatusHovered, setIsStatusHovered] = useState(false);

  const selectedItem = items.find(i => i.id === selectedId) || null;

  const visibleItems = items.filter(item => 
    isArchiveView ? item.archived : !item.archived
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const {
    activeId,
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDragEnd,
  } = useProgressDrag({ onReorder: reorderItems });

  const onDragStart = (event: any) => {
    handleDragStart(event);
    const node = document.getElementById(`sortable-item-${event.active.id}`);
    if (node) {
      setDragWidth(node.offsetWidth);
    }
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
  };

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

  const now = new Date();
  const day = now.getDate();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  
  const pendingCount = items.filter(i => {
    if (i.archived) return false;
    if (i.type === 'progress') return i.current < i.total;
    return true;
  }).length;

  const archivedCount = items.filter(i => i.archived).length;

  const greeting = pendingCount === 0 ? 'All Done' : `${pendingCount} Pending`;

  const handlePreviewChange = useCallback((icon?: string, title?: string) => {
    if (icon === undefined && title === undefined) {
      setPreviewOverride(null);
    } else {
      setPreviewOverride(prev => {
        if (prev?.icon === icon && prev?.title === title) return prev;
        return { icon, title };
      });
    }
  }, []);

  return (
    <div className="h-full bg-white dark:bg-zinc-900 flex flex-col relative overflow-hidden">
      {/* Right: Levitating Lens Button (Organic Liquid Soul) */}
      <AnimatePresence>
        {!isArchiveView && (
          <motion.div 
            className="absolute top-5 z-40 pointer-events-none flex items-center gap-3"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              right: isScrolled ? 8 : 24
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 850, damping: 35, mass: 0.5 }}
          >
            <motion.button
              layout
              onClick={openCreateModal}
              initial={false}
              animate={{
                width: isScrolled ? 40 : "auto",
                height: 40,
                paddingLeft: isScrolled ? 0 : 16,
                paddingRight: isScrolled ? 0 : 20,
                backgroundColor: isScrolled ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.6)',
                borderRadius: 9999,
                gap: isScrolled ? 0 : 8,
              }}
              style={{ borderRadius: 9999 }}
              transition={{ 
                type: "spring", 
                stiffness: 850, 
                damping: 35,
                mass: 0.5 
              }}
              className="
                pointer-events-auto
                group flex items-center justify-center
                backdrop-blur-xl
                border border-white/40 dark:border-white/10
                shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08),0_2px_4px_-1px_rgba(0,0,0,0.04)]
                hover:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.12),0_4px_8px_-2px_rgba(0,0,0,0.06)]
                hover:bg-white/90 dark:bg-zinc-800/80
                text-zinc-800 dark:text-zinc-100
                transition-shadow duration-300
              "
            >
              {/* Icon - Pure & Floating */}
              <motion.div 
                layout="position"
                className="flex items-center justify-center shrink-0 relative z-10"
              >
                <Plus className="size-4" />
              </motion.div>
              
              {/* Text - Organic Reveal */}
              <motion.div
                initial={false}
                animate={{ 
                  width: isScrolled ? 0 : "auto",
                  opacity: isScrolled ? 0 : 1,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.8 }}
                className="overflow-hidden flex items-center"
              >
                <motion.span 
                  animate={{ 
                    x: isScrolled ? -20 : 0,
                    filter: isScrolled ? "blur(10px)" : "blur(0px)",
                    opacity: isScrolled ? 0 : 1
                  }}
                  transition={{ type: "spring", stiffness: 850, damping: 35, mass: 0.5 }}
                  className="text-[13px] font-bold tracking-wider uppercase whitespace-nowrap leading-none pt-[1px]"
                >
                  New
                </motion.span>
              </motion.div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content (Scrollable) */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="
          flex-1 overflow-y-auto px-6 py-4 pt-6
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-zinc-200
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:hover:bg-zinc-300
          dark:[&::-webkit-scrollbar-thumb]:bg-zinc-800
          dark:[&::-webkit-scrollbar-thumb]:hover:bg-zinc-700
        "
      >
        {/* Header Section: "Time Sculpture" */}
        <div className="relative mb-2 mt-2 min-h-[50px] select-none">

             <motion.div 
                key={isArchiveView ? 'archive' : 'normal'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                className="relative pl-2"
              >
                {!isArchiveView ? (
                  <>
                    {/* Giant Number - The Foundation */}
                    <div className="absolute -top-6 -left-4 text-[5rem] leading-none font-thin text-zinc-50 dark:text-zinc-800/30 select-none pointer-events-none tracking-tighter mix-blend-multiply dark:mix-blend-screen">
                      {day}
                    </div>
                    
                    {/* Content Layer - Floating above */}
                    <div className="relative z-10 pt-0 flex flex-col gap-0">
                      {/* Greeting / Status - The Call to Action */}
                      <div 
                        onClick={() => setIsArchiveView(true)}
                        className="flex items-center gap-1.5 mb-0.5 cursor-pointer"
                      >
                        <motion.div 
                          onMouseEnter={() => setIsStatusHovered(true)}
                          onMouseLeave={() => setIsStatusHovered(false)}
                          className="group/status relative flex items-center justify-start h-4 overflow-hidden"
                        >
                          <AnimatePresence mode="wait" initial={false}>
                          {isStatusHovered ? (
                            <motion.div
                              key="archive-hint"
                              initial={{ y: 10, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: -10, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300"
                            >
                              <Archive className="size-3" />
                              <span className="text-[9px] font-bold tracking-[0.25em] uppercase">
                                HISTORY
                              </span>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="status-text"
                              initial={{ y: 10, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: -10, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                            >
                              <span className="text-[9px] font-bold tracking-[0.25em] text-zinc-400 dark:text-zinc-500 uppercase transition-colors">
                                {greeting.toUpperCase()}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        </motion.div>
                      </div>

                      {/* Weekday - The Temporal Anchor */}
                      <h1 className="text-2xl font-serif italic font-light text-zinc-800 dark:text-zinc-100 tracking-tight">
                        {weekday}
                      </h1>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative z-10 flex flex-col gap-0 w-full pl-0 -mt-2">
                        {/* Single Row: Back Arrow -> Title -> Count */}
                        <div className="flex items-center gap-3 w-full">
                          {/* Back Button - Pure Art (Minimalist Arrow) */}
                          <button 
                            onClick={() => setIsArchiveView(false)}
                            className="group relative flex items-center justify-center py-2 pr-2 -ml-1 cursor-pointer outline-none"
                            title="Back to List"
                          >
                            <ArrowLeft 
                              className="size-5 text-zinc-400 group-hover:text-zinc-900 dark:text-zinc-500 dark:group-hover:text-zinc-100 transition-colors duration-300 transform group-hover:-translate-x-1" 
                            />
                          </button>

                          {/* Title & Count - The Narrative */}
                          <div className="flex items-baseline gap-3 select-none">
                            <h1 
                              onClick={() => setIsArchiveView(false)}
                              className="text-2xl font-serif italic font-light text-zinc-800 dark:text-zinc-100 tracking-tight cursor-pointer"
                            >
                              Archived
                            </h1>
                            <span className="text-xs font-medium text-zinc-300 dark:text-zinc-600 font-serif italic">
                              {archivedCount}
                            </span>
                          </div>
                        </div>
                    </div>
                  </>
                )}
             </motion.div>
        </div>

        <div className="px-6 pb-4">
          {visibleItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                {isArchiveView ? (
                  <Archive className="size-8 text-zinc-300 dark:text-zinc-600" />
                ) : (
                  <Plus className="size-8 text-zinc-300 dark:text-zinc-600" />
                )}
              </div>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 font-medium">
                {isArchiveView ? 'Storage box is empty' : 'Start tracking your first habit'}
              </p>
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            measuring={{
              droppable: {
                strategy: MeasuringStrategy.Always,
              },
            }}
            onDragStart={onDragStart}
            onDragMove={handleDragMove}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleItems.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {visibleItems.map((item) => {
                  return (
                    <div key={item.id} id={`sortable-item-${item.id}`}>
                      <ItemCard
                        item={item}
                        onUpdate={updateCurrent}
                        onClick={() => setSelectedId(item.id)}
                        onAutoArchive={handleAutoArchive}
                        onDelete={deleteItem}
                        isDragging={activeId === item.id}
                        previewIcon={selectedItem?.id === item.id ? previewOverride?.icon : undefined}
                        previewTitle={selectedItem?.id === item.id ? previewOverride?.title : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            </SortableContext>

            {createPortal(
              <DragOverlay 
                dropAnimation={null} 
                className="cursor-grabbing" 
                style={{ zIndex: 999999 }}
              >
                {activeId ? (() => {
                  const item = items.find(i => i.id === activeId);
                  if (!item) return null;
                  
                  return (
                    <div className="w-full" style={{ width: dragWidth ? `${dragWidth}px` : '100%' }}>
                      {item.archived ? (
                        <ArchivedItemCard 
                          item={item}
                          onUpdate={updateCurrent}
                          onClick={() => {}}
                          onAutoArchive={handleAutoArchive}
                          onDelete={deleteItem}
                          isDragging={true}
                        />
                      ) : (
                        <ActiveItemCard 
                          item={item}
                          onUpdate={updateCurrent}
                          onClick={() => {}}
                          onAutoArchive={handleAutoArchive}
                          isDragging={true}
                        />
                      )}
                    </div>
                  );
                })() : null}
              </DragOverlay>,
              document.body
            )}
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
        onClose={() => setSelectedId(null)}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onPreviewChange={handlePreviewChange}
      />
    </div>
  );
}