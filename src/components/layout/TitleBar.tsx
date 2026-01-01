import { ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Settings, PanelLeft, PanelRight, MessageCircle, Star, MoreHorizontal, FileText, X, Plus } from 'lucide-react';
import { NotePencil, CalendarBlank } from '@phosphor-icons/react';
import { WindowControls } from './WindowControls';
import { useUIStore } from '@/stores/uiSlice';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';

const appWindow = getCurrentWindow();

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
    isStarred,
    toggleStarred,
    openTabs,
    closeTab,
    openNote,
  } = useNotesStore();

  const starred = currentNote ? isStarred(currentNote.path) : false;
  
  // Sidebar width from NotesPage - used to align tabs with content area
  const SIDEBAR_WIDTH = 248;
  const RESIZE_HANDLE_WIDTH = 4; // 1px handle
  
  const startDrag = async () => {
    await appWindow.startDragging();
  };

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
          <div className="flex items-center overflow-x-auto neko-scrollbar gap-1 px-2 h-full flex-shrink-0">
            {openTabs.map((tab) => (
              <div
                key={tab.path}
                onClick={() => openNote(tab.path)}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    closeTab(tab.path);
                  }
                }}
                className={cn(
                  "group relative flex items-center gap-2 px-3 py-1.5 cursor-pointer min-w-0 max-w-[200px]",
                  "transition-all rounded-lg my-1",
                  currentNote?.path === tab.path 
                    ? "bg-white dark:bg-zinc-800 shadow-sm" 
                    : "hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
                )}
              >
                <FileText 
                  className={cn(
                    "w-4 h-4 flex-shrink-0",
                    currentNote?.path === tab.path 
                      ? "text-[var(--neko-accent)]" 
                      : "text-zinc-400 dark:text-zinc-500"
                  )} 
                />
                
                <span className={cn(
                  "text-[13px] truncate",
                  currentNote?.path === tab.path 
                    ? "text-zinc-700 dark:text-zinc-200 font-medium" 
                    : "text-zinc-500 dark:text-zinc-400"
                )}>
                  {tab.name}
                </span>
                
                {tab.isDirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--neko-accent)] flex-shrink-0" />
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.path);
                  }}
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
            ))}
            
            {/* Add new tab button */}
            {openTabs.length > 0 && (
              <button
                onClick={() => {
                  // This will be handled by the store
                }}
                className={cn(
                  "flex-shrink-0 p-1.5 rounded-lg transition-colors",
                  "text-zinc-300 dark:text-zinc-600",
                  "hover:text-zinc-500 dark:hover:text-zinc-400"
                )}
                title="New tab (Ctrl+T)"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          
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
          
          {/* Star button */}
          <button
            onClick={() => currentNote && toggleStarred(currentNote.path)}
            className={cn(
              "h-full w-8 flex items-center justify-center transition-colors",
              "hover:bg-zinc-100 dark:hover:bg-zinc-800",
              starred 
                ? "text-yellow-500" 
                : "text-zinc-300 dark:text-zinc-600 hover:text-yellow-500"
            )}
            title={starred ? "Unstar" : "Star"}
          >
            <Star className="size-4" fill={starred ? "currentColor" : "none"} />
          </button>
          
          {/* More options */}
          <button
            className={cn(
              "h-full w-8 flex items-center justify-center transition-colors",
              "hover:bg-zinc-100 dark:hover:bg-zinc-800",
              "text-zinc-300 dark:text-zinc-600"
            )}
            title="More options"
          >
            <MoreHorizontal className="size-4" />
          </button>
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
