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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(tab.path)}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onClose(tab.path);
        }
      }}
      className={cn(
        "group relative flex items-center gap-2 px-3 py-1.5 cursor-pointer min-w-0 max-w-[200px]",
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
  
  // Sidebar width from NotesPage - used to align tabs with content area
  const SIDEBAR_WIDTH = 248;
  const RESIZE_HANDLE_WIDTH = 4; // 1px handle
  
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
      {/* White background area for main content - creates the "cutout" effect */}
      {appViewMode === 'notes' && !sidebarCollapsed && (
        <div 
          className="absolute top-0 bottom-0 right-0 bg-white dark:bg-zinc-800 rounded-tl-xl"
          style={{ 
            left: SIDEBAR_WIDTH + RESIZE_HANDLE_WIDTH,
          }}
        />
      )}

      {/* Left: Sidebar Toggle (Notes view only) */}
      {appViewMode === 'notes' && (
        <button
          onClick={toggleSidebar}
          className={cn(
            "h-full w-9 flex items-center justify-center transition-colors z-20",
            "hover:bg-zinc-100 dark:hover:bg-zinc-800",
            !sidebarCollapsed
              ? "text-zinc-400 dark:text-zinc-500"
              : "text-zinc-200 dark:text-zinc-700"
          )}
          title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        >
          <PanelLeft className="size-4" />
        </button>
      )}

      {/* Settings Button */}
      <button
        onClick={onOpenSettings}
        className="h-full px-3 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-20"
        title="Settings"
      >
        <Settings className="size-4 text-zinc-200 hover:text-zinc-400 dark:text-zinc-700 dark:hover:text-zinc-500" />
      </button>

      {/* Notes/Calendar Toggle Button */}
      <button
        onClick={toggleAppViewMode}
        className="h-full px-3 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-20"
        title={appViewMode === 'calendar' ? 'Switch to Notes' : 'Switch to Calendar'}
      >
        {appViewMode === 'calendar' ? (
          <NotePencil className="size-4 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300" weight="duotone" />
        ) : (
          <CalendarBlank className="size-4 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300" weight="duotone" />
        )}
      </button>

      {/* Note Tabs (Notes view only) - positioned to align with sidebar edge */}
      {appViewMode === 'notes' && (
        <div 
          className="absolute top-0 bottom-0 flex items-center z-20"
          style={{ 
            left: sidebarCollapsed ? 0 : SIDEBAR_WIDTH + RESIZE_HANDLE_WIDTH,
            right: 120, // Leave space for right buttons
          }}
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
              <div className="flex items-center overflow-x-auto neko-scrollbar gap-1 px-2 h-full flex-shrink-0">
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
          
          {/* Draggable empty area - fills remaining space */}
          <div 
            className="flex-1 h-full cursor-default"
            onMouseDown={startDrag}
          />
        </div>
      )}

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

      {/* Spacer to push toolbar and controls to the right */}
      <div className="flex-1" />

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
