import React, { memo, useCallback } from 'react';
import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { useNotesStore } from '@/stores/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { cn } from '@/lib/utils';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { useNoteLabelDescriptor } from '../common/noteDisambiguation';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { resolveSiblingNoteParentPath } from '@/stores/notes/notePathState';
import { NotesDragOverlay } from '../common/NotesDragOverlay';
import { NoteTabContent } from './NoteTabContent';
import { truncateNoteLabel } from '../common/truncateNoteLabel';

interface SortableTabProps {
  tab: { path: string; name: string; isDirty: boolean };
  isActive: boolean;
  onClose: (path: string) => void | Promise<void>;
  onClick: (path: string) => void;
  showSeparator?: boolean;
}

const SortableTab = memo(function SortableTab({
  tab,
  isActive,
  onClose,
  onClick,
  showSeparator,
}: SortableTabProps) {
  const icon = useDisplayIcon(tab.path);
  const { title, disambiguation } = useNoteLabelDescriptor(tab.path, tab.name);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: tab.path });
  const labelRef = React.useRef<HTMLSpanElement | null>(null);
  const [isLabelClipped, setIsLabelClipped] = React.useState(false);
  const isTitleShortened = truncateNoteLabel(title) !== title;
  const shouldShowTitleTooltip = isTitleShortened || isLabelClipped;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined,
  };

  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest('button'));

  const updateLabelClipped = React.useCallback(() => {
    const label = labelRef.current;
    if (!label) {
      setIsLabelClipped(false);
      return;
    }
    setIsLabelClipped(label.scrollWidth > label.clientWidth + 1);
  }, []);

  React.useEffect(() => {
    updateLabelClipped();
    const label = labelRef.current;
    if (!label || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateLabelClipped);
    observer.observe(label);
    return () => observer.disconnect();
  }, [title, disambiguation, updateLabelClipped]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isInteractiveTarget(e.target)) {
      return;
    }

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
            if (isInteractiveTarget(e.target)) {
              return;
            }
            if (e.button === 1) return;
            onClick(tab.path);
          }}
          onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onMouseEnter={updateLabelClipped}
          onFocus={updateLabelClipped}
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
          <NoteTabContent
            tab={tab}
            isActive={isActive}
            icon={icon}
            title={title}
            disambiguation={disambiguation}
            labelRef={labelRef}
          />

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose(tab.path);
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className={cn(
              'ml-auto rounded p-0.5 opacity-0 transition-all pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100',
              'text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400'
            )}
          >
            <Icon name="common.close" className="h-4 w-4" />
          </button>
        </div>
      </TooltipTrigger>
      {shouldShowTitleTooltip ? (
        <TooltipContent
          side="bottom"
          sideOffset={6}
          showArrow={false}
          className={cn(
            'rounded-[18px] px-3 py-2 text-xs text-[var(--chat-sidebar-text)]',
            chatComposerPillSurfaceClass,
          )}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium">{title}</span>
            {disambiguation ? (
              <span className="text-[11px] text-current/70">{disambiguation}</span>
            ) : null}
          </div>
        </TooltipContent>
      ) : null}
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
      <NoteTabContent
        tab={tab}
        isActive={isActive}
        icon={icon}
        title={title}
        disambiguation={disambiguation}
      />
    </div>
  );
}

export function NotesTabRow() {
  const { t } = useI18n();
  const currentVaultPath = useVaultStore((s) => s.currentVault?.path ?? null);
  const currentNotePath = useNotesStore((s) => s.currentNote?.path);
  const notesPath = useNotesStore((s) => s.notesPath);
  const rootFolderPath = useNotesStore((s) => s.rootFolderPath);
  const openTabs = useNotesStore((s) => s.openTabs);
  const closeTab = useNotesStore((s) => s.closeTab);
  const openNote = useNotesStore((s) => s.openNote);
  const createNote = useNotesStore((s) => s.createNote);
  const reorderTabs = useNotesStore((s) => s.reorderTabs);
  const hasOpenedFolder = Boolean(currentVaultPath && notesPath === currentVaultPath && rootFolderPath === currentVaultPath);

  const [activeTabId, setActiveTabId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleCreateNote = useCallback(() => {
    const folderPath = resolveSiblingNoteParentPath(
      useNotesStore.getState().draftNotes,
      currentNotePath,
    );
    createNote(folderPath);
  }, [currentNotePath, createNote]);

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
    <div className="group/tab-row flex h-full w-full min-w-0 items-center gap-1 px-2">
      <div
        className={cn(
          'vlaina-no-drag flex h-8 max-w-full min-w-0 items-center rounded-full px-1.5 transition-all duration-200',
          chatComposerPillSurfaceClass,
        )}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={openTabs.map((tab) => tab.path)} strategy={horizontalListSortingStrategy}>
            <div className="flex min-w-0 items-center overflow-x-auto">
              {openTabs.map((tab, index) => (
                <SortableTab
                  key={tab.path}
                  tab={tab}
                  isActive={currentNotePath === tab.path}
                  onClose={closeTab}
                  onClick={(path) => void openNote(path)}
                  showSeparator={index > 0}
                />
              ))}
            </div>
          </SortableContext>

          <NotesDragOverlay>
            {activeTab ? (
              <TabOverlay tab={activeTab} isActive={currentNotePath === activeTab.path} />
            ) : null}
          </NotesDragOverlay>
        </DndContext>
      </div>

      {hasOpenedFolder ? (
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCreateNote}
              className="notes-tab-row-new-note-button vlaina-no-drag pointer-events-none flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 opacity-0 transition-all group-hover/tab-row:pointer-events-auto group-hover/tab-row:opacity-100 group-focus-within/tab-row:pointer-events-auto group-focus-within/tab-row:opacity-100 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <Icon name="common.add" className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            sideOffset={6}
            showArrow={false}
            className={cn(
              'flex items-center gap-1.5 rounded-[18px] px-3 py-2 text-xs text-[var(--chat-sidebar-text)]',
              chatComposerPillSurfaceClass,
            )}
          >
            <span>{t('sidebar.newNote')}</span>
            <ShortcutKeys
              keys={['Ctrl', 'T']}
              keyClassName="rounded-md bg-[var(--chat-sidebar-row-hover)] text-[var(--chat-sidebar-text)]"
            />
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
