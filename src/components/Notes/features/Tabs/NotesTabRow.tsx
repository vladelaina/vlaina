import React, { memo, useCallback } from 'react';
import {
  MdDescription,
  MdClose,
  MdAdd,
} from 'react-icons/md';
import { useNotesStore } from '@/stores/useNotesStore';
import { useDisplayIcon, useDisplayName } from '@/hooks/useTitleSync';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { NoteIcon } from '@/components/Notes/features/IconPicker/NoteIcon';
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
          <NoteIcon icon={icon} size={18} />
        </span>
      ) : (
        <MdDescription
          className="w-[18px] h-[18px] flex-shrink-0 pointer-events-none text-current opacity-70"
        />
      )}

      <span className={cn(
        "text-[13px] truncate pointer-events-none text-current",
        isActive && "font-medium"
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
  showSeparator?: boolean;
}

const SortableTab = memo(function SortableTab({ tab, isActive, onClose, onClick, showSeparator }: SortableTabProps) {
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
    <Tooltip delayDuration={1000}>
      <TooltipTrigger asChild>
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
            "rounded-md transition-colors",
            isActive
              ? "text-zinc-800 dark:text-zinc-100"
              : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300",
            isDragging && "opacity-50 z-50"
          )}
        >
          {/* Subtle separator line between tabs */}
          {showSeparator && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-[18px] bg-zinc-200 dark:bg-zinc-700" />
          )}
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
            <MdClose className="w-[18px] h-[18px]" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={5}>
        <span className="text-xs font-medium">{displayName || tab.name}</span>
      </TooltipContent>
    </Tooltip>
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
        "rounded-md shadow-md bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm",
        isActive
          ? "text-zinc-800 dark:text-zinc-100"
          : "text-zinc-500 dark:text-zinc-400"
      )}
    >
      <TabContent tab={tab} isActive={isActive} icon={icon} displayName={displayName} />
    </div>
  );
}

export function NotesTabRow() {
  const currentNote = useNotesStore(s => s.currentNote);
  const openTabs = useNotesStore(s => s.openTabs);
  const closeTab = useNotesStore(s => s.closeTab);
  const openNote = useNotesStore(s => s.openNote);
  const createNote = useNotesStore(s => s.createNote);
  const reorderTabs = useNotesStore(s => s.reorderTabs);

  const [activeTabId, setActiveTabId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleCreateNote = useCallback(() => {
    const folderPath = currentNote?.path
      ? currentNote.path.substring(0, currentNote.path.lastIndexOf('/')) || undefined
      : undefined;
    createNote(folderPath);
  }, [currentNote?.path, createNote]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTabId(event.active.id as string);
  };

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

  return (
    <div className="flex-1 flex items-center overflow-hidden min-w-0 h-full" data-tauri-drag-region>
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
                <div className="flex items-center px-2 h-full min-w-0 flex-shrink" data-tauri-drag-region>
                    {openTabs.map((tab, index) => (
                        <SortableTab
                            key={tab.path}
                            tab={tab}
                            isActive={currentNote?.path === tab.path}
                            onClose={closeTab}
                            onClick={openNote}
                            showSeparator={index > 0}
                        />
                    ))}

                    {/* Add new tab button */}
                    {openTabs.length > 0 && (
                        <Tooltip delayDuration={1000}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleCreateNote}
                                    className={cn(
                                        "flex-shrink-0 p-1.5 rounded-lg transition-colors",
                                        "text-zinc-300 dark:text-zinc-600",
                                        "hover:text-zinc-500 dark:hover:text-zinc-400"
                                    )}
                                >
                                    <MdAdd className="w-[18px] h-[18px]" />
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
    </div>
  );
}