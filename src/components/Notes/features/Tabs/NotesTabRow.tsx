import React, { memo, useCallback } from 'react';
import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { useNotesStore } from '@/stores/useNotesStore';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { cn } from '@/lib/utils';
import {
  chatComposerGhostIconButtonClass,
  chatComposerPillSurfaceClass,
} from '@/components/Chat/features/Input/composerStyles';
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
import { themeUiFeedbackTokens } from '@/styles/themeTokens';

const EMPTY_NOTE_NAVIGATION_HISTORY: never[] = [];

function NoteHistoryButton({
  direction,
  disabled,
  label,
  onNavigate,
}: {
  direction: 'back' | 'forward';
  disabled: boolean;
  label: string;
  onNavigate: () => Promise<void>;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void onNavigate();
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      className={cn(
        'notes-tab-row-history-button app-no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all',
        chatComposerGhostIconButtonClass,
        'text-[var(--vlaina-color-tab-muted-fg)] disabled:pointer-events-none disabled:opacity-[var(--vlaina-opacity-35)]'
      )}
    >
      <Icon name={direction === 'back' ? 'nav.chevronLeft' : 'nav.chevronRight'} className="h-4 w-4" />
    </button>
  );
}

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
  const { title, disambiguation, isUntitledPlaceholder } = useNoteLabelDescriptor(tab.path, tab.name);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: tab.path });
  const labelRef = React.useRef<HTMLSpanElement | null>(null);
  const labelClipFrameRef = React.useRef<number | null>(null);
  const [isLabelClipped, setIsLabelClipped] = React.useState(false);
  const shouldShowTitleTooltip = isLabelClipped;

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

  const scheduleLabelClippedUpdate = React.useCallback(() => {
    if (labelClipFrameRef.current !== null) {
      return;
    }

    labelClipFrameRef.current = requestAnimationFrame(() => {
      labelClipFrameRef.current = null;
      updateLabelClipped();
    });
  }, [updateLabelClipped]);

  React.useEffect(() => {
    updateLabelClipped();
    const label = labelRef.current;
    if (!label || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(scheduleLabelClippedUpdate);
    observer.observe(label);
    return () => {
      observer.disconnect();
      if (labelClipFrameRef.current !== null) {
        cancelAnimationFrame(labelClipFrameRef.current);
        labelClipFrameRef.current = null;
      }
    };
  }, [title, disambiguation, scheduleLabelClippedUpdate, updateLabelClipped]);

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
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          data-notes-block-drop-target="true"
          data-notes-tab-path={tab.path}
          data-notes-tab-active={isActive ? 'true' : undefined}
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
              ? 'text-[var(--vlaina-color-tab-active-fg)]'
              : 'text-[var(--vlaina-color-tab-muted-fg)] hover:text-[var(--vlaina-color-tab-muted-hover-fg)]',
            isDragging && 'z-[var(--vlaina-z-50)] opacity-[var(--vlaina-opacity-50)]'
          )}
        >
          {showSeparator && (
            <div className="absolute left-0 top-1/2 h-[var(--vlaina-size-18px)] w-px -translate-y-1/2 bg-[var(--vlaina-color-tab-separator)]" />
          )}
          <NoteTabContent
            tab={tab}
            isActive={isActive}
            icon={icon}
            title={title}
            disambiguation={disambiguation}
            isUntitledPlaceholder={isUntitledPlaceholder}
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
              'ml-auto rounded p-0.5 opacity-[var(--vlaina-opacity-0)] transition-all pointer-events-none group-hover:pointer-events-auto group-hover:opacity-[var(--vlaina-opacity-100)] group-focus-within:pointer-events-auto group-focus-within:opacity-[var(--vlaina-opacity-100)]',
              'text-[var(--vlaina-color-tab-close-fg)] hover:text-[var(--vlaina-color-tab-close-hover-fg)]'
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
            'rounded-[var(--vlaina-radius-18px)] px-3 py-2 text-xs text-[var(--vlaina-sidebar-chat-text)]',
            chatComposerPillSurfaceClass,
          )}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium">{title}</span>
            {disambiguation ? (
              <span className="text-[var(--vlaina-font-11)] text-current/70">{disambiguation}</span>
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
  const { title, disambiguation, isUntitledPlaceholder } = useNoteLabelDescriptor(tab.path, tab.name);
  return (
    <div
      className={cn(
        'flex min-w-0 max-w-[var(--vlaina-size-200px)] items-center gap-2 rounded-md bg-[var(--vlaina-color-tab-overlay-bg)] px-3 py-1.5 shadow-[var(--vlaina-shadow-md)] backdrop-blur-[var(--vlaina-backdrop-blur-sm)]',
        isActive ? 'text-[var(--vlaina-color-tab-active-fg)]' : 'text-[var(--vlaina-color-tab-muted-fg)]'
      )}
    >
      <NoteTabContent
        tab={tab}
        isActive={isActive}
        icon={icon}
        title={title}
        disambiguation={disambiguation}
        isUntitledPlaceholder={isUntitledPlaceholder}
      />
    </div>
  );
}

export function NotesTabRow() {
  const { t } = useI18n();
  const currentNotesRootPath = useNotesRootStore((s) => s.currentNotesRoot?.path ?? null);
  const currentNotePath = useNotesStore((s) => s.currentNote?.path);
  const notesPath = useNotesStore((s) => s.notesPath);
  const rootFolderPath = useNotesStore((s) => s.rootFolderPath);
  const openTabs = useNotesStore((s) => s.openTabs);
  const closeTab = useNotesStore((s) => s.closeTab);
  const openNote = useNotesStore((s) => s.openNote);
  const createNote = useNotesStore((s) => s.createNote);
  const reorderTabs = useNotesStore((s) => s.reorderTabs);
  const noteNavigationHistory = useNotesStore((s) => s.noteNavigationHistory ?? EMPTY_NOTE_NAVIGATION_HISTORY);
  const noteNavigationHistoryIndex = useNotesStore((s) => s.noteNavigationHistoryIndex ?? -1);
  const navigateBackInNoteHistory = useNotesStore((s) => s.navigateBackInNoteHistory);
  const navigateForwardInNoteHistory = useNotesStore((s) => s.navigateForwardInNoteHistory);
  const hasOpenedFolder = Boolean(currentNotesRootPath && notesPath === currentNotesRootPath && rootFolderPath === currentNotesRootPath);
  const hasOpenTabs = openTabs.length > 0;
  const hasNoteNavigationHistory = noteNavigationHistory.length > 1;
  const canNavigateBack = noteNavigationHistoryIndex > 0;
  const canNavigateForward =
    noteNavigationHistoryIndex >= 0 &&
    noteNavigationHistoryIndex < noteNavigationHistory.length - 1;

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
    createNote(folderPath, { asDraft: true });
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
      {hasOpenTabs ? (
        <div
          className={cn(
            'app-no-drag flex h-8 max-w-full min-w-0 items-center rounded-full px-1.5 transition-all duration-[var(--vlaina-duration-200)]',
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
      ) : null}

      {hasOpenedFolder ? (
        <Tooltip delayDuration={themeUiFeedbackTokens.defaultTooltipDelayMs}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCreateNote}
              className={cn(
                'notes-tab-row-new-note-button app-no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all',
                hasOpenTabs
                  ? 'pointer-events-none opacity-[var(--vlaina-opacity-0)] group-hover/tab-row:pointer-events-auto group-hover/tab-row:opacity-[var(--vlaina-opacity-100)] group-focus-within/tab-row:pointer-events-auto group-focus-within/tab-row:opacity-[var(--vlaina-opacity-100)]'
                  : 'pointer-events-auto opacity-[var(--vlaina-opacity-100)]',
                chatComposerGhostIconButtonClass,
                'text-[var(--vlaina-color-tab-muted-fg)]'
              )}
            >
              <Icon name="common.add" className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            sideOffset={6}
            showArrow={false}
            className={cn(
              'flex items-center gap-1.5 rounded-[var(--vlaina-radius-18px)] px-3 py-2 text-xs text-[var(--vlaina-sidebar-chat-text)]',
              chatComposerPillSurfaceClass,
            )}
          >
            <span>{t('sidebar.newNote')}</span>
            <ShortcutKeys
              keys={['Ctrl', 'Shift', 'T']}
              keyClassName="rounded-md bg-[var(--vlaina-sidebar-chat-row-hover)] text-[var(--vlaina-sidebar-chat-text)]"
            />
          </TooltipContent>
        </Tooltip>
      ) : null}

      {hasNoteNavigationHistory ? (
        <div
          className={cn(
            'notes-tab-row-history-controls flex h-7 w-14 shrink-0 items-center justify-center transition-all',
            hasOpenTabs
              ? 'pointer-events-none opacity-[var(--vlaina-opacity-0)] group-hover/tab-row:pointer-events-auto group-hover/tab-row:opacity-[var(--vlaina-opacity-100)] group-focus-within/tab-row:pointer-events-auto group-focus-within/tab-row:opacity-[var(--vlaina-opacity-100)]'
              : 'pointer-events-auto opacity-[var(--vlaina-opacity-100)]'
          )}
        >
          <NoteHistoryButton
            direction="back"
            disabled={!canNavigateBack}
            label={t('notes.previous')}
            onNavigate={navigateBackInNoteHistory}
          />
          <NoteHistoryButton
            direction="forward"
            disabled={!canNavigateForward}
            label={t('notes.next')}
            onNavigate={navigateForwardInNoteHistory}
          />
        </div>
      ) : null}
    </div>
  );
}
