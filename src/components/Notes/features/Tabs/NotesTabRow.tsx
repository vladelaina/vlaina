import React, { memo, useCallback } from 'react';
import { Icon } from '@/components/ui/icons';
import { useNotesStore } from '@/stores/useNotesStore';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { NoteIcon } from '@/components/Notes/features/IconPicker/NoteIcon';
import { useNoteLabelDescriptor } from '../common/noteDisambiguation';
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
  title: string;
  disambiguation?: string | null;
}

function TabContent({ tab, isActive, icon, title, disambiguation }: TabContentProps) {
  return (
    <>
      {icon ? (
        <span className="pointer-events-none flex-shrink-0">
          <NoteIcon icon={icon} size="md" />
        </span>
      ) : (
        <Icon
          name="file.text"
          className="pointer-events-none h-[18px] w-[18px] flex-shrink-0 text-[var(--notes-sidebar-file-icon)]"
        />
      )}

      <span className={cn('pointer-events-none truncate text-[13px] text-current', isActive && 'font-medium')}>
        {title}
        {disambiguation ? (
          <span className="text-[11px] text-current/65">{` · ${disambiguation}`}</span>
        ) : null}
      </span>

      {tab.isDirty && (
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--vlaina-accent)] pointer-events-none" />
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
  const { title, disambiguation } = useNoteLabelDescriptor(tab.path, tab.name);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: tab.path });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined,
  };

  const handlePointerDown = (e: React.PointerEvent) => {
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
            'group relative flex min-w-0 flex-shrink cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 transition-colors',
            isActive
              ? 'text-zinc-800 dark:text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300',
            isDragging && 'z-50 opacity-50'
          )}
        >
          {showSeparator && (
            <div className="absolute left-0 top-1/2 h-[18px] w-px -translate-y-1/2 bg-zinc-200 dark:bg-zinc-700" />
          )}
          <TabContent tab={tab} isActive={isActive} icon={icon} title={title} disambiguation={disambiguation} />

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.path);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              'ml-auto rounded p-0.5 opacity-0 transition-all group-hover:opacity-100',
              'text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400'
            )}
          >
            <Icon size="md" name="common.close" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={5}>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium">{title}</span>
          {disambiguation ? (
            <span className="text-[11px] text-current/70">{disambiguation}</span>
          ) : null}
        </div>
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
  const { title, disambiguation } = useNoteLabelDescriptor(tab.path, tab.name);
  return (
    <div
      className={cn(
        'flex min-w-0 max-w-[200px] items-center gap-2 rounded-md bg-white/90 px-3 py-1.5 shadow-md backdrop-blur-sm dark:bg-zinc-800/90',
        isActive ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'
      )}
    >
      <TabContent tab={tab} isActive={isActive} icon={icon} title={title} disambiguation={disambiguation} />
    </div>
  );
}

export function NotesTabRow() {
  const currentNote = useNotesStore((s) => s.currentNote);
  const openTabs = useNotesStore((s) => s.openTabs);
  const closeTab = useNotesStore((s) => s.closeTab);
  const openNote = useNotesStore((s) => s.openNote);
  const createNote = useNotesStore((s) => s.createNote);
  const reorderTabs = useNotesStore((s) => s.reorderTabs);

  const [activeTabId, setActiveTabId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleCreateNote = useCallback(() => {
    const currentPath = currentNote?.path;
    const folderPath = currentPath && currentPath.includes('/')
      ? currentPath.substring(0, currentPath.lastIndexOf('/')) || undefined
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
      const oldIndex = openTabs.findIndex((tab) => tab.path === active.id);
      const newIndex = openTabs.findIndex((tab) => tab.path === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderTabs(oldIndex, newIndex);
      }
    }
  };

  const activeTab = activeTabId ? openTabs.find((tab) => tab.path === activeTabId) : null;

  return (
    <div className="flex h-full min-w-0 items-center gap-1 px-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={openTabs.map((tab) => tab.path)} strategy={horizontalListSortingStrategy}>
          <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
            {openTabs.map((tab, index) => (
              <SortableTab
                key={tab.path}
                tab={tab}
                isActive={currentNote?.path === tab.path}
                onClose={closeTab}
                onClick={(path) => void openNote(path)}
                showSeparator={index > 0}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeTab ? (
            <TabOverlay tab={activeTab} isActive={currentNote?.path === activeTab.path} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCreateNote}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Icon name="common.add" className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={5} className="flex items-center gap-1.5 text-xs">
          <span>New Note</span>
          <ShortcutKeys keys={['Ctrl', 'N']} />
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
