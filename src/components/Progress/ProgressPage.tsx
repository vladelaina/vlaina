import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  defaultAnimateLayoutChanges,
  type AnimateLayoutChanges,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { invoke } from '@tauri-apps/api/core';
import { ChevronLeft, Plus, Minus, GripVertical } from 'lucide-react';
import { useProgressStore, type ProgressItem, type CounterItem } from '@/stores/useProgressStore';

type ViewMode = 'list' | 'create-progress' | 'create-counter';

// Disable drop animation to prevent "snap back" effect
const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args;
  if (isSorting || wasDragging) {
    return false;
  }
  return defaultAnimateLayoutChanges(args);
};

// Update position without awaiting result for smoother animation
const updatePositionFast = (x: number, y: number) => {
  invoke('update_drag_window_position', { x, y }).catch(() => {});
};

export function ProgressPage() {
  const { items, addProgress, addCounter, updateCurrent, deleteItem, loadItems, reorderItems } = useProgressStore();
  
  useEffect(() => {
    loadItems();
  }, [loadItems]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
  // Progress form state
  const [progressForm, setProgressForm] = useState({
    title: '',
    note: '',
    direction: 'increment' as 'increment' | 'decrement',
    total: 100,
    step: 1,
    unit: '次',
  });
  
  // Counter form state
  const [counterForm, setCounterForm] = useState({
    title: '',
    step: 1,
    unit: '次',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
  });

  const handleCreateProgress = () => {
    if (!progressForm.title.trim()) return;
    addProgress({
      title: progressForm.title.trim(),
      note: progressForm.note.trim() || undefined,
      direction: progressForm.direction,
      total: progressForm.total,
      step: progressForm.step,
      unit: progressForm.unit.trim() || '次',
    });
    setProgressForm({ title: '', note: '', direction: 'increment', total: 100, step: 1, unit: '次' });
    setViewMode('list');
  };

  const handleCreateCounter = () => {
    if (!counterForm.title.trim()) return;
    addCounter({
      title: counterForm.title.trim(),
      step: counterForm.step,
      unit: counterForm.unit.trim() || '次',
      frequency: counterForm.frequency,
    });
    setCounterForm({ title: '', step: 1, unit: '次', frequency: 'daily' });
    setViewMode('list');
  };

  const handleDragStart = useCallback(async (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    
    const item = items.find(i => i.id === id);
    if (item) {
      const itemElement = document.querySelector(`[data-item-id="${id}"]`);
      const rect = itemElement?.getBoundingClientRect();
      const width = rect?.width || 350;
      const height = rect?.height || 80;
      
      const pointer = (event.activatorEvent as PointerEvent);
      const isDarkMode = document.documentElement.classList.contains('dark');
      
      // 构建更详细的显示内容
      let displayContent = item.title;
      if (item.type === 'progress') {
        const percentage = Math.round((item.current / item.total) * 100);
        displayContent += `\n${item.current}/${item.total}${item.unit} (${percentage}%) • 今天${item.todayCount}${item.unit}`;
      } else {
        displayContent += `\n总计${item.current}${item.unit} • 今天${item.todayCount}${item.unit}`;
      }
      
      try {
        await invoke('create_drag_window', {
          content: displayContent,
          x: pointer.screenX,
          y: pointer.screenY,
          width: width,
          height: height,
          isDone: false,
          isDark: isDarkMode,
          priority: 'default',
        });
      } catch (e) {
        console.error('Failed to create drag window:', e);
      }
    }
  }, [items]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!event.activatorEvent) return;
    const rect = event.activatorEvent as PointerEvent;
    // Calculate current position with delta
    const x = rect.screenX + (event.delta?.x || 0);
    const y = rect.screenY + (event.delta?.y || 0);
    updatePositionFast(x, y);
  }, []);

  const handleDragOver = useCallback((event: DragMoveEvent) => {
    setOverId(event.over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setOverId(null);
    
    try {
      await invoke('destroy_drag_window');
    } catch (e) {
      // ignore
    }
    
    if (over && active.id !== over.id) {
      reorderItems(active.id as string, over.id as string);
    }
  }, [reorderItems]);
  
  useEffect(() => {
    return () => {
      invoke('destroy_drag_window').catch(() => {});
    };
  }, []);

  // 创建进度页面
  if (viewMode === 'create-progress') {
    return (
      <div className="h-full bg-white dark:bg-zinc-900 flex flex-col">
        <div className="flex items-center gap-3 px-6 py-3">
          <button
            onClick={() => setViewMode('list')}
            className="p-1 -ml-1 rounded text-zinc-300 hover:text-zinc-500 transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm text-zinc-400">创建进度</span>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <div>
            <label className="block text-xs text-zinc-400 mb-2">标题</label>
            <input
              type="text"
              value={progressForm.title}
              onChange={(e) => setProgressForm({ ...progressForm, title: e.target.value })}
              placeholder="输入标题..."
              className="w-full px-0 py-1 text-sm bg-transparent border-b border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400 placeholder:text-zinc-300"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-2">备注</label>
            <input
              type="text"
              value={progressForm.note}
              onChange={(e) => setProgressForm({ ...progressForm, note: e.target.value })}
              placeholder="可选..."
              className="w-full px-0 py-1 text-sm bg-transparent border-b border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400 placeholder:text-zinc-300"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-2">类型</label>
            <div className="flex gap-3">
              <button
                onClick={() => setProgressForm({ ...progressForm, direction: 'increment' })}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  progressForm.direction === 'increment'
                    ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-800'
                    : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                递增
              </button>
              <button
                onClick={() => setProgressForm({ ...progressForm, direction: 'decrement' })}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  progressForm.direction === 'decrement'
                    ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-800'
                    : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                递减
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-2">总量</label>
              <input
                type="number"
                value={progressForm.total}
                onChange={(e) => setProgressForm({ ...progressForm, total: Number(e.target.value) || 0 })}
                className="w-20 px-0 py-1 text-sm bg-transparent border-b border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-2">步长</label>
              <input
                type="number"
                value={progressForm.step}
                onChange={(e) => setProgressForm({ ...progressForm, step: Number(e.target.value) || 1 })}
                className="w-16 px-0 py-1 text-sm bg-transparent border-b border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-2">单位</label>
              <input
                type="text"
                value={progressForm.unit}
                onChange={(e) => setProgressForm({ ...progressForm, unit: e.target.value })}
                className="w-16 px-0 py-1 text-sm bg-transparent border-b border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400"
              />
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          <button
            onClick={handleCreateProgress}
            disabled={!progressForm.title.trim()}
            className="w-full py-2 text-sm text-zinc-600 border border-zinc-200 rounded hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            创建
          </button>
        </div>
      </div>
    );
  }

  // 创建计数页面
  if (viewMode === 'create-counter') {
    return (
      <div className="h-full bg-white dark:bg-zinc-900 flex flex-col">
        <div className="flex items-center gap-3 px-6 py-3">
          <button
            onClick={() => setViewMode('list')}
            className="p-1 -ml-1 rounded text-zinc-300 hover:text-zinc-500 transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm text-zinc-400">创建计数</span>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <div>
            <label className="block text-xs text-zinc-400 mb-2">标题</label>
            <input
              type="text"
              value={counterForm.title}
              onChange={(e) => setCounterForm({ ...counterForm, title: e.target.value })}
              placeholder="输入标题..."
              className="w-full px-0 py-1 text-sm bg-transparent border-b border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400 placeholder:text-zinc-300"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-2">频率</label>
            <div className="flex gap-3">
              {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                <button
                  key={freq}
                  onClick={() => setCounterForm({ ...counterForm, frequency: freq })}
                  className={`px-3 py-1.5 text-xs rounded transition-colors ${
                    counterForm.frequency === freq
                      ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-800'
                      : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  {freq === 'daily' ? '每日' : freq === 'weekly' ? '每周' : '每月'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-2">步长</label>
              <input
                type="number"
                value={counterForm.step}
                onChange={(e) => setCounterForm({ ...counterForm, step: Number(e.target.value) || 1 })}
                className="w-16 px-0 py-1 text-sm bg-transparent border-b border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-2">单位</label>
              <input
                type="text"
                value={counterForm.unit}
                onChange={(e) => setCounterForm({ ...counterForm, unit: e.target.value })}
                className="w-16 px-0 py-1 text-sm bg-transparent border-b border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400"
              />
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          <button
            onClick={handleCreateCounter}
            disabled={!counterForm.title.trim()}
            className="w-full py-2 text-sm text-zinc-600 border border-zinc-200 rounded hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            创建
          </button>
        </div>
      </div>
    );
  }

  // 主列表页面
  return (
    <div className="h-full bg-white dark:bg-zinc-900 flex flex-col pt-2 relative">
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {items.length === 0 && (
          <p className="text-sm text-zinc-300 text-center py-12">暂无进度</p>
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
                    {item.type === 'progress' 
                      ? <ProgressCard 
                          item={item} 
                          onUpdate={updateCurrent} 
                          onDelete={deleteItem}
                          isDragging={activeId === item.id}
                        />
                      : <CounterCard 
                          item={item} 
                          onUpdate={updateCurrent} 
                          onDelete={deleteItem}
                          isDragging={activeId === item.id}
                        />
                    }
                    {insertAfter && isDropTarget && (
                      <div className="h-20 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/50 mt-3" />
                    )}
                  </div>
                );
              })}
            </div>
          </SortableContext>
          <DragOverlay>
            {/* 空的 DragOverlay 阻止默认预览，只显示 Rust 窗口 */}
            {null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* FAB */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-2">
        {showFabMenu && (
          <>
            <button
              onClick={() => {
                setViewMode('create-counter');
                setShowFabMenu(false);
              }}
              className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm rounded-full shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              + 计数
            </button>
            <button
              onClick={() => {
                setViewMode('create-progress');
                setShowFabMenu(false);
              }}
              className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm rounded-full shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              + 进度
            </button>
          </>
        )}
        <button
          onClick={() => setShowFabMenu(!showFabMenu)}
          className={`w-14 h-14 rounded-full bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-800 shadow-lg hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-all flex items-center justify-center ${
            showFabMenu ? 'rotate-45' : ''
          }`}
        >
          <Plus className="size-6" />
        </button>
      </div>
    </div>
  );
}

function ProgressCard({ 
  item, 
  onUpdate, 
  onDelete,
  isDragging
}: { 
  item: ProgressItem; 
  onUpdate: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}) {
  const percentage = Math.round((item.current / item.total) * 100);
  const step = item.direction === 'increment' ? item.step : -item.step;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useSortable({ 
    id: item.id,
    animateLayoutChanges,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      data-item-id={item.id}
      className={`group flex items-center gap-2 px-2 py-2 rounded-md border border-transparent ${
        isDragging 
          ? 'h-0 overflow-hidden opacity-0 !p-0 !m-0' 
          : 'hover:bg-muted/50 hover:border-border/50'
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-100 cursor-move p-0.5 rounded hover:bg-muted transition-opacity duration-150 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/60" />
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground mb-1">{item.title}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-1.5 py-0.5 bg-muted rounded text-xs">进度</span>
          <span>{item.current}/{item.total}{item.unit}</span>
          <span className="text-muted-foreground/60">今天{item.todayCount}{item.unit}</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-foreground/40 transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{percentage}%</span>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        <button
          onClick={() => onUpdate(item.id, -step)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Decrease"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={() => onUpdate(item.id, step)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Increase"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Delete"
        >
          <span className="text-xs">×</span>
        </button>
      </div>
    </div>
  );
}

function CounterCard({ 
  item, 
  onUpdate, 
  onDelete,
  isDragging
}: { 
  item: CounterItem; 
  onUpdate: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useSortable({ 
    id: item.id,
    animateLayoutChanges,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      data-item-id={item.id}
      className={`group flex items-center gap-2 px-2 py-2 rounded-md border border-transparent ${
        isDragging 
          ? 'h-0 overflow-hidden opacity-0 !p-0 !m-0' 
          : 'hover:bg-muted/50 hover:border-border/50'
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-100 cursor-move p-0.5 rounded hover:bg-muted transition-opacity duration-150 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/60" />
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground mb-1">{item.title}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-1.5 py-0.5 bg-muted rounded text-xs">计数</span>
          <span>总计{item.current}{item.unit}</span>
          <span className="text-muted-foreground/60">今天{item.todayCount}{item.unit}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        <button
          onClick={() => onUpdate(item.id, -item.step)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Decrease"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={() => onUpdate(item.id, item.step)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Increase"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Delete"
        >
          <span className="text-xs">×</span>
        </button>
      </div>
    </div>
  );
}
