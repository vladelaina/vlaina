import React, { ReactNode, memo, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  FileText,
  X,
  Plus,
  StickyNote,
} from 'lucide-react';

import { WindowControls } from './WindowControls';
import { TitleBarButton } from './TitleBarButton';
import { useUIStore } from '@/stores/uiSlice';
import { useNotesStore } from '@/stores/useNotesStore';

import { useDisplayIcon, useDisplayName } from '@/hooks/useTitleSync';
import { cn, NOTES_COLORS, iconButtonStyles } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { NoteIcon } from '@/components/Notes/features/IconPicker/NoteIcon';
import { useVaultStore } from '@/stores/useVaultStore';
import { useShortcuts } from '@/hooks/useShortcuts';
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

interface TabContentProps {
  tab: { path: string; name: string; isDirty: boolean };
  isActive: boolean;
  icon?: string;
  displayName?: string;
}

function TabContent({ tab, isActive, icon, displayName }: TabContentProps) {
  return (
    <>
      {icon ? (
        <span className="flex-shrink-0 pointer-events-none">
          <NoteIcon icon={icon} size={16} />
        </span>
      ) : (
        <FileText
          className={cn(
            "w-4 h-4 flex-shrink-0 pointer-events-none",
            isActive
              ? "text-[var(--neko-accent)]"
              : "text-zinc-400 dark:text-zinc-500"
          )}
        />
      )}

      <span className={cn(
        "text-[13px] truncate pointer-events-none",
        isActive
          ? "text-zinc-700 dark:text-zinc-200 font-medium"
          : "text-zinc-500 dark:text-zinc-400"
      )}>
        {displayName || tab.name}
      </span>

      {tab.isDirty && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--neko-accent)] flex-shrink-0 pointer-events-none" />
      )}
    </>
  );
}

interface SortableTabProps {
  tab: { path: string; name: string; isDirty: boolean };
  isActive: boolean;
  onClose: (path: string) => void | Promise<void>;
  onClick: (path: string) => void;
}

const SortableTab = memo(function SortableTab({ tab, isActive, onClose, onClick }: SortableTabProps) {
  const icon = useDisplayIcon(tab.path);
  const displayName = useDisplayName(tab.path);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: tab.path });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined,
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Middle click closes tab without triggering drag
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      onClose(tab.path);
      return;
    }
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
        if (e.button === 1) return;
        onClick(tab.path);
      }}
      onAuxClick={(e) => {
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
      <TabContent tab={tab} isActive={isActive} icon={icon} displayName={displayName} />

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
});

interface TabOverlayProps {
  tab: { path: string; name: string; isDirty: boolean };
  isActive: boolean;
}

function TabOverlay({ tab, isActive }: TabOverlayProps) {
  const icon = useDisplayIcon(tab.path);
  const displayName = useDisplayName(tab.path);
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
      <TabContent tab={tab} isActive={isActive} icon={icon} displayName={displayName} />
    </div>
  );
}

import { WorkspaceSwitcher } from './WorkspaceSwitcher';

interface TitleBarProps {
  onOpenSettings?: () => void;
  toolbar?: ReactNode;
  content?: ReactNode;
  /** When true, window controls are hidden (shown in right panel instead) */
  hideWindowControls?: boolean;
}

export function TitleBar({ onOpenSettings, toolbar, content, hideWindowControls }: TitleBarProps) {
  const { appViewMode, toggleAppViewMode, notesSidebarCollapsed, notesSidebarWidth, toggleNotesSidebar, sidebarHeaderHovered, setSidebarHeaderHovered } = useUIStore();
  const { currentVault } = useVaultStore();

  const currentNote = useNotesStore(s => s.currentNote);
  const openTabs = useNotesStore(s => s.openTabs);
  const closeTab = useNotesStore(s => s.closeTab);
  const openNote = useNotesStore(s => s.openNote);
  const createNote = useNotesStore(s => s.createNote);
  const reorderTabs = useNotesStore(s => s.reorderTabs);

  // Alias for cleaner code
  const sidebarCollapsed = notesSidebarCollapsed;
  const sidebarWidth = notesSidebarWidth;
  const toggleSidebar = toggleNotesSidebar;

  // Use white background when no vault is selected (welcome screen)
  const titleBarBgColor = currentVault ? NOTES_COLORS.sidebarBg : 'var(--neko-bg-primary)';

  const RESIZE_HANDLE_WIDTH = 4;

  const [activeTabId, setActiveTabId] = React.useState<string | null>(null);

  // DnD sensors for tab reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const startDrag = useCallback(async () => {
    await getCurrentWindow().startDragging();
  }, []);

  // Handle new note creation
  const handleCreateNote = React.useCallback(() => {
    const folderPath = currentNote?.path
      ? currentNote.path.substring(0, currentNote.path.lastIndexOf('/')) || undefined
      : undefined;
    createNote(folderPath);
  }, [currentNote?.path, createNote]);

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

  const activeTab = activeTabId ? openTabs.find(tab => tab.path === activeTabId) : null;

  useShortcuts({ scope: 'notes' });

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) startDrag();
      }}
      className="h-10 dark:bg-zinc-900 flex items-center select-none relative z-50"
      style={{ backgroundColor: titleBarBgColor }}
    >
      {/* Welcome screen - only show window controls */}
      {appViewMode === 'notes' && !currentVault && (
        <>
          <div
            className="flex-1 h-full cursor-default"
            onMouseDown={startDrag}
          />
          {!hideWindowControls && <WindowControls className="z-50" minimal />}
        </>
      )}

      {/* Normal notes view with vault */}
      {appViewMode === 'notes' && currentVault && (
        <>
          {/* Left sidebar area - matches sidebar width */}
          {!sidebarCollapsed && (
            <div
              className="h-full flex items-center justify-between flex-shrink-0 z-20 px-3 group"
              style={{ width: sidebarWidth }}
              onMouseEnter={() => setSidebarHeaderHovered(true)}
              onMouseLeave={() => setSidebarHeaderHovered(false)}
            >
              {/* User info with dropdown */}
              <WorkspaceSwitcher onOpenSettings={onOpenSettings} />
              {/* Collapse button - hidden by default, visible on header hover or divider hover */}
              <button
                onClick={toggleSidebar}
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0",
                  iconButtonStyles,
                  sidebarHeaderHovered ? "opacity-100" : "opacity-0",
                  "transition-opacity"
                )}
                title="Collapse sidebar"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* When sidebar is collapsed, show expand button */}
          {sidebarCollapsed && (
            <div className="flex items-center z-20">
              <button
                onClick={toggleSidebar}
                className={cn(
                  "flex items-center justify-center w-9 h-full",
                  iconButtonStyles,
                  "group"
                )}
                title="Expand sidebar"
              >
                {/* Default: Menu (Hamburger), Hover: ChevronsRight (>>) */}
                <Menu className="w-4 h-4 group-hover:hidden" />
                <ChevronsRight className="w-4 h-4 hidden group-hover:block" />
              </button>
            </div>
          )}

          {/* Resize handle spacer - only when sidebar is expanded */}
          {!sidebarCollapsed && (
            <div className="w-1 h-full flex-shrink-0" />
          )}

          {/* White background area for main content - creates the "cutout" effect */}
          {!sidebarCollapsed && (
            <div
              className="absolute top-0 bottom-0 right-0 bg-white dark:bg-zinc-800 rounded-tl-xl"
              style={{
                left: sidebarWidth + RESIZE_HANDLE_WIDTH,
              }}
            />
          )}

          {/* White background when sidebar is collapsed */}
          {sidebarCollapsed && (
            <div
              className="absolute top-0 bottom-0 left-0 right-0 bg-white dark:bg-zinc-800"
            />
          )}

          {/* Note Tabs */}
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
                          New Tab
                          <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ backgroundColor: '#2B2B2B' }}>Ctrl</kbd>
                          <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ backgroundColor: '#2B2B2B' }}>T</kbd>
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </SortableContext>

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

          {/* Window Controls */}
          {!hideWindowControls && <WindowControls className="z-50" />}
        </>
      )
      }

      {/* Calendar view buttons */}
      {
        appViewMode === 'calendar' && (
          <>
            <div className="flex items-center z-20">
              <TitleBarButton icon={Settings} onClick={onOpenSettings} />
              <TitleBarButton icon={StickyNote} onClick={toggleAppViewMode} />
            </div>

            {/* Spacer */}
            <div className="flex-1" />

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

            {/* Window Controls */}
            {!hideWindowControls && <WindowControls className="z-50" />}
          </>
        )
      }
    </div >
  );
}
