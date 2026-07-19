import React, { memo } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { Icon } from '@/components/ui/icons';
import {
  ghostIconButtonClass,
  raisedPillSurfaceClass,
} from '@/components/ui/surfaceStyles';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { cn } from '@/lib/utils';
import { NoteTabContent } from './NoteTabContent';
import { useNoteLabelDescriptor } from '../common/noteDisambiguation';

export function NoteHistoryButton({
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
        ghostIconButtonClass,
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

export const SortableTab = memo(function SortableTab({
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
            'rounded-[var(--vlaina-notes-ui-radius-tooltip)] px-3 py-2 text-xs text-[var(--vlaina-sidebar-chat-text)]',
            raisedPillSurfaceClass,
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

export function TabOverlay({ tab, isActive }: TabOverlayProps) {
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
