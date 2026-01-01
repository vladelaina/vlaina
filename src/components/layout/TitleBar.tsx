import React, { ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Settings, PanelLeft, PanelRight, MessageCircle, FileText, X, Plus } from 'lucide-react';
import { NotePencil, CalendarBlank } from '@phosphor-icons/react';
import { WindowControls } from './WindowControls';
import { useUIStore } from '@/stores/uiSlice';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const appWindow = getCurrentWindow();

// 可排序的标签组件
interface SortableTabProps {
  tab: { path: string; name: string; isDirty: boolean };
  isActive: boolean;
  onClose: (path: string) => void;
  onClick: (path: string) => void;
}

function SortableTab({ tab, isActive, onClose, onClick }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: tab.path });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined, // 禁用动画
  };

  // 处理指针按下事件，合并 dnd-kit 的 listeners
  const handlePointerDown = (e: React.PointerEvent) => {
    // 中键点击直接关闭标签，不触发拖拽
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      onClose(tab.path);
      return;
    }
    // 其他情况调用 dnd-kit 的处理器
    listeners?.onPointerDown?.(e);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onClick={(e) => {
        // 中键点击不触发切换
        if (e.button === 1) return;
        onClick(tab.path);
      }}
      onAuxClick={(e) => {
        // 阻止中键点击的默认行为
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={cn(
        "group relative flex items-center gap-2 px-3 py-1.5 cursor-pointer min-w-0 flex-shrink",
        "rounded-lg my-1",
        isActive 
          ? "bg-white dark:bg-zinc-800 shadow-sm" 
          : "hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50",
        isDragging && "opacity-50 z-50"
      )}
    >
      <FileText 
        className={cn(
          "w-4 h-4 flex-shrink-0 pointer-events-none",
          isActive 
            ? "text-[var(--neko-accent)]" 
            : "text-zinc-400 dark:text-zinc-500"
        )} 
      />
      
      <span className={cn(
        "text-[13px] truncate pointer-events-none",
        isActive 
          ? "text-zinc-700 dark:text-zinc-200 font-medium" 
          : "text-zinc-500 dark:text-zinc-400"
      )}>
        {tab.name}
      </span>
      
      {tab.isDirty && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--neko-accent)] flex-shrink-0 pointer-events-none" />
      )}
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.path);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "p-0.5 rounded transition-all ml-auto",
          "opacity-0 group-hover:opacity-100",
          "text-zinc-300 dark:text-zinc-600",
          "hover:text-zinc-500 dark:hover:text-zinc-400"
        )}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// 拖拽预览组件
interface TabOverlayProps {
  tab: { path: string; name: string; isDirty: boolean };
  isActive: boolean;
}

function TabOverlay({ tab, isActive }: TabOverlayProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 min-w-0 max-w-[200px]",
        "rounded-lg shadow-lg",
        isActive 
          ? "bg-white dark:bg-zinc-800" 
          : "bg-zinc-100 dark:bg-zinc-700"
      )}
    >
      <FileText 
        className={cn(
          "w-4 h-4 flex-shrink-0",
          isActive 
            ? "text-[var(--neko-accent)]" 
            : "text-zinc-400 dark:text-zinc-500"
        )} 
      />
      
      <span className={cn(
        "text-[13px] truncate",
        isActive 
          ? "text-zinc-700 dark:text-zinc-200 font-medium" 
          : "text-zinc-500 dark:text-zinc-400"
      )}>
        {tab.name}
      </span>
      
      {tab.isDirty && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--neko-accent)] flex-shrink-0" />
      )}
    </div>
  );
}

interface TitleBarProps {
  onOpenSettings?: () => void;
  toolbar?: ReactNode;
  content?: ReactNode;
  /** When true, window controls are hidden (shown in right panel instead) */
  hideWindowControls?: boolean;
}

export function TitleBar({ onOpenSettings, toolbar, content, hideWindowControls }: TitleBarProps) {
  const { appViewMode, toggleAppViewMode } = useUIStore();
  const { 
    sidebarCollapsed, 
    sidebarWidth,
    rightPanelCollapsed, 
    showAIPanel,
    toggleSidebar, 
    toggleRightPanel,
    toggleAIPanel,
    currentNote,
    isDirty,
    openTabs,
    closeTab,
    openNote,
    createNote,
    reorderTabs,
  } = useNotesStore();
  
  // Resize handle width
  const RESIZE_HANDLE_WIDTH = 4;
  
  // 当前拖拽的标签
  const [activeTabId, setActiveTabId] = React.useState<string | null>(null);
  
  // DnD sensors for tab reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );
  
  const startDrag = async () => {
    await appWindow.startDragging();
  };

  // Get current note's folder path
  const getCurrentFolderPath = () => {
    if (!currentNote?.path) return undefined;
    const lastSlash = currentNote.path.lastIndexOf('/');
    return lastSlash > 0 ? currentNote.path.substring(0, lastSlash) : undefined;
  };

  // Handle new note creation
  const handleCreateNote = () => {
    createNote(getCurrentFolderPath());
  };

  // Handle tab drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveTabId(event.active.id as string);
  };

  // Handle tab drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveTabId(null);
    
    if (over && active.id !== over.id) {
      const oldIndex = openTabs.findIndex(tab => tab.path === active.id);
      const newIndex = openTabs.findIndex(tab => tab.path === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderTabs(oldIndex, newIndex);
      }
    }
  };
  
  // 获取当前拖拽的标签
  const activeTab = activeTabId ? openTabs.find(tab => tab.path === activeTabId) : null;

  // Keyboard shortcut for Ctrl+T
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 't' && appViewMode === 'notes') {
        e.preventDefault();
        handleCreateNote();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appViewMode, currentNote?.path]);

  return (
    <div 
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) startDrag();
      }}
      className="h-10 bg-[#F6F6F6] dark:bg-zinc-900 flex items-center select-none relative z-50"
    >
      {/* Left sidebar area - matches sidebar width */}
      {appViewMode === 'notes' && !sidebarCollapsed && (
        <div 
          className="h-full flex items-center flex-shrink-0 z-20"
          style={{ width: sidebarWidth }}
        >
          {/* Sidebar Toggle */}
          <button
            onClick={toggleSidebar}
            className={cn(
              "h-full w-9 flex items-center justify-center transition-colors",
              "hover:bg-zinc-100 dark:hover:bg-zinc-800",
              "text-zinc-400 dark:text-zinc-500"
            )}
            title="Hide sidebar"
          >
            <PanelLeft className="size-4" />
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="h-full px-3 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Settings"
          >
            <Settings className="size-4 text-zinc-200 hover:text-zinc-400 dark:text-zinc-700 dark:hover:text-zinc-500" />
          </button>

          {/* Notes/Calendar Toggle Button */}
          <button
            onClick={toggleAppViewMode}
            className="h-full px-3 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Switch to Calendar"
          >
            <CalendarBlank className="size-4 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300" weight="duotone" />
          </button>
          
          {/* Draggable area to fill remaining space in sidebar header */}
          <div 
            className="flex-1 h-full cursor-default"
            onMouseDown={startDrag}
          />
        </div>
      )}

      {/* When sidebar is collapsed, show buttons normally */}
      {appViewMode === 'notes' && sidebarCollapsed && (
        <>
          <button
            onClick={toggleSidebar}
            className={cn(
              "h-full w-9 flex items-center justify-center transition-colors z-20",
              "hover:bg-zinc-100 dark:hover:bg-zinc-800",
              "text-zinc-200 dark:text-zinc-700"
            )}
            title="Show sidebar"
          >
            <PanelLeft className="size-4" />
          </button>

          <button
            onClick={onOpenSettings}
            className="h-full px-3 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-20"
            title="Settings"
          >
            <Settings className="size-4 text-zinc-200 hover:text-zinc-400 dark:text-zinc-700 dark:hover:text-zinc-500" />
          </button>

          <button
            onClick={toggleAppViewMode}
            className="h-full px-3 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-20"
            title="Switch to Calendar"
          >
            <CalendarBlank className="size-4 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300" weight="duotone" />
          </button>
        </>
      )}

      {/* Calendar view buttons */}
      {appViewMode === 'calendar' && (
        <>
          <button
            onClick={onOpenSettings}
            className="h-full px-3 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-20"
            title="Settings"
          >
            <Settings className="size-4 text-zinc-200 hover:text-zinc-400 dark:text-zinc-700 dark:hover:text-zinc-500" />
          </button>

          <button
            onClick={toggleAppViewMode}
            className="h-full px-3 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-20"
            title="Switch to Notes"
          >
            <NotePencil className="size-4 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300" weight="duotone" />
          </button>
        </>
      )}

      {/* Resize handle spacer - only when sidebar is expanded */}
      {appViewMode === 'notes' && !sidebarCollapsed && (
        <div className="w-1 h-full flex-shrink-0" />
      )}

      {/* White background area for main content - creates the "cutout" effect */}
      {appViewMode === 'notes' && !sidebarCollapsed && (
        <div 
          className="absolute top-0 bottom-0 right-0 bg-white dark:bg-zinc-800 rounded-tl-xl"
          style={{ 
            left: sidebarWidth + RESIZE_HANDLE_WIDTH,
          }}
        />
      )}

      {/* Note Tabs (Notes view only) - in flex flow with other elements */}
      {appViewMode === 'notes' && (
        <div 
          className="flex-1 flex items-center z-20 overflow-hidden min-w-0 h-full"
        >
          {/* Tabs container */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={openTabs.map(tab => tab.path)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex items-center gap-1 px-2 h-full min-w-0 flex-shrink">
                {openTabs.map((tab) => (
                  <SortableTab
                    key={tab.path}
                    tab={tab}
                    isActive={currentNote?.path === tab.path}
                    onClose={closeTab}
                    onClick={openNote}
                  />
                ))}
                
                {/* Add new tab button */}
                {openTabs.length > 0 && (
                  <Tooltip delayDuration={500}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleCreateNote}
                        className={cn(
                          "flex-shrink-0 p-1.5 rounded-lg transition-colors",
                          "text-zinc-300 dark:text-zinc-600",
                          "hover:text-zinc-500 dark:hover:text-zinc-400"
                        )}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={2}>
                      <span className="flex items-center gap-1.5">
                        新建标签页
                        <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ backgroundColor: '#2B2B2B' }}>Ctrl</kbd>
                        <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ backgroundColor: '#2B2B2B' }}>T</kbd>
                      </span>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </SortableContext>
            
            {/* 拖拽预览 */}
            <DragOverlay dropAnimation={null}>
              {activeTab ? (
                <TabOverlay 
                  tab={activeTab} 
                  isActive={currentNote?.path === activeTab.path} 
                />
              ) : null}
            </DragOverlay>
          </DndContext>
          
          {/* Draggable empty area - fills remaining space, outside DndContext */}
          <div 
            className="flex-1 h-full min-w-[20px] cursor-default"
            onMouseDown={startDrag}
          />
        </div>
      )}

      {/* Spacer - only when not in notes view */}
      {appViewMode !== 'notes' && <div className="flex-1" />}

      {/* Center Content Area - Absolutely positioned for true centering */}
      {content && (
        <div 
          onMouseDown={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).hasAttribute('data-tauri-drag-region')) {
              startDrag();
            }
          }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          data-tauri-drag-region
        >
          <div className="pointer-events-auto">
            {content}
          </div>
        </div>
      )}

      {/* Custom Toolbar (e.g., Calendar controls) */}
      {toolbar && (
        <div className="flex items-center h-full z-20 pr-3">
          {toolbar}
        </div>
      )}

      {/* Note Editor Actions (Notes view only, when note is open) */}
      {appViewMode === 'notes' && currentNote && (
        <div className="flex items-center gap-0.5 z-20 mr-1">
          {/* Dirty indicator */}
          {isDirty && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--neko-accent-light)] text-[var(--neko-accent)] mr-1">
              Editing
            </span>
          )}
        </div>
      )}

      {/* Right Panel Toggle (Notes view only) */}
      {appViewMode === 'notes' && (
        <button
          onClick={toggleRightPanel}
          className={cn(
            "h-full w-9 flex items-center justify-center transition-colors z-20",
            "hover:bg-zinc-100 dark:hover:bg-zinc-800",
            !rightPanelCollapsed
              ? "text-zinc-400 dark:text-zinc-500"
              : "text-zinc-200 dark:text-zinc-700"
          )}
          title={rightPanelCollapsed ? "Show right panel" : "Hide right panel"}
        >
          <PanelRight className="size-4" />
        </button>
      )}

      {/* AI Chat Toggle (Notes view only) */}
      {appViewMode === 'notes' && (
        <button
          onClick={toggleAIPanel}
          className={cn(
            "h-full w-9 flex items-center justify-center transition-colors z-20",
            "hover:bg-zinc-100 dark:hover:bg-zinc-800",
            showAIPanel
              ? "text-zinc-400 dark:text-zinc-500"
              : "text-zinc-200 dark:text-zinc-700"
          )}
          title={showAIPanel ? "Hide AI Chat" : "Show AI Chat"}
        >
          <MessageCircle className="size-4" />
        </button>
      )}

      {/* Window Controls - only show when right panel is hidden */}
      {!hideWindowControls && <WindowControls className="z-50" />}
    </div>
  );
}
