/**
 * EventBlock - Calendar event block component
 * 
 * Responsibilities: Rendering + drag interaction dispatch
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Check, Pause } from 'lucide-react';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { EventContextMenu } from './EventContextMenu';
import { type EventLayoutInfo } from '../../utils/eventLayout';
import type { NekoEvent } from '@/lib/ics/types';
import { calculateEventTop, calculateEventHeight, CALENDAR_CONSTANTS, DEFAULT_DAY_START_MINUTES } from '../../utils/timeUtils';
import { getEventInlineStyles } from '@/lib/colors';
import { AppIcon } from '@/components/common/AppIcon';
import { useEventTimer, formatElapsedTime, getHeightLevel } from './hooks/useEventTimer';

const GAP = CALENDAR_CONSTANTS.GAP as number;
const RESIZE_HANDLE_HEIGHT = CALENDAR_CONSTANTS.RESIZE_HANDLE_HEIGHT as number;

interface EventBlockProps {
  event: NekoEvent;
  layout?: EventLayoutInfo;
  hourHeight: number;
  onToggle?: (id: string) => void;
  onDragStart?: (eventId: string, edge: 'top' | 'bottom' | null, clientY: number) => void;
  onHover?: (startMinutes: number | null, endMinutes: number | null) => void;
  dayStartMinutes?: number;
}

export function EventBlock({ event, layout, hourHeight, onToggle, onDragStart, onHover, dayStartMinutes = DEFAULT_DAY_START_MINUTES }: EventBlockProps) {
  const {
    setEditingEventId, editingEventId,
    setSelectedEventId, closeEditingEvent,
    use24Hour, deleteEvent, allEvents,
    universalPreviewTarget, universalPreviewIcon, universalPreviewColor, universalPreviewIconSize
  } = useCalendarStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<'top' | 'bottom' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);

  const isActive = editingEventId === event.uid;
  const isCompleted = event.completed;

  // Calculate position and size
  const startDate = event.dtstart.getTime();
  const endDate = event.dtend.getTime();

  const top = calculateEventTop(startDate, hourHeight, dayStartMinutes);
  const plannedDuration = endDate - startDate;
  const plannedHeight = calculateEventHeight(startDate, endDate, hourHeight);

  // Timer state management via hook
  const { elapsedMs, isTimerActive, isTimerPaused, actualHeight } = useEventTimer({
    event,
    plannedHeight,
    hourHeight,
  });

  const height = actualHeight;
  const heightLevel = getHeightLevel(height);

  // Color - use preview color when hovering, otherwise use event color
  const displayColor = (universalPreviewTarget === event.uid && universalPreviewColor !== null)
    ? universalPreviewColor
    : event.color;
  const colorStyles = getEventInlineStyles(displayColor);
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const bgColor = isDark ? colorStyles.bgDark : colorStyles.bg;
  const textColor = isDark ? colorStyles.textDark : colorStyles.text;
  const ringColor = isDark ? colorStyles.ringDark : colorStyles.ring;
  const fillColor = isDark ? colorStyles.fillDark : colorStyles.fill;

  // Position calculation
  const positioning = useMemo(() => {
    if (!layout) {
      return { left: `${GAP}px`, width: `calc(100% - ${GAP * 2}px)` };
    }

    const { leftPercent, widthPercent, totalColumns, column } = layout;

    const isFirstColumn = column === 0;
    const isLastColumn = column === totalColumns - 1;

    const leftPadding = isFirstColumn ? GAP : GAP / 2;
    const rightPadding = isLastColumn ? GAP : GAP / 2;

    const totalPadding = leftPadding + rightPadding;

    return {
      left: `calc(${leftPercent}% + ${leftPadding}px)`,
      width: `calc(${widthPercent}% - ${totalPadding}px)`,
    };
  }, [layout]);

  // z-index
  const zIndex = useMemo(() => {
    const column = layout?.column || 0;
    const baseZ = column + 10;
    if (isDragging) return 50;
    if (isActive) return 100;
    if (isHovered) return 40;
    return baseZ;
  }, [layout?.column, isActive, isHovered, isDragging]);

  // Shadow
  const shadowClass = useMemo(() => {
    if (isDragging) return 'shadow-xl shadow-black/15 dark:shadow-black/40';
    if (isActive) return 'shadow-lg shadow-black/10 dark:shadow-black/30';
    if (isHovered) return 'shadow-md shadow-black/8 dark:shadow-black/25';
    return 'shadow-sm shadow-black/5 dark:shadow-black/15';
  }, [isActive, isHovered, isDragging]);

  // Cursor
  const cursorClass = useMemo(() => {
    if (isDragging) return 'cursor-grabbing';
    if (resizeEdge) return 'cursor-row-resize';
    return 'cursor-default';
  }, [resizeEdge, isDragging]);

  // Event handlers
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;

    if (relativeY <= RESIZE_HANDLE_HEIGHT) {
      setResizeEdge('top');
    } else if (relativeY >= rect.height - RESIZE_HANDLE_HEIGHT) {
      setResizeEdge('bottom');
    } else {
      setResizeEdge(null);
    }
  }, [isDragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startY = e.clientY;
    const LONG_PRESS_DELAY = 150;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;

    longPressTimer = setTimeout(() => {
      setIsDragging(true);
      onDragStart?.(event.uid, resizeEdge, startY);
    }, LONG_PRESS_DELAY);

    const handleMouseUp = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      setIsDragging(false);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mouseup', handleMouseUp);
  }, [event.uid, resizeEdge, onDragStart]);

  const handleClick = useCallback(() => {
    if (isDragging) return;
    if (resizeEdge) return;

    if (editingEventId && editingEventId !== event.uid) {
      const editingEvent = allEvents.find(ev => ev.uid === editingEventId);
      if (editingEvent && !editingEvent.summary.trim()) {
        deleteEvent(editingEventId);
      }
      closeEditingEvent();
    }

    setSelectedEventId(event.uid);
    setEditingEventId(event.uid);
  }, [isDragging, resizeEdge, editingEventId, event.uid, closeEditingEvent, setSelectedEventId, setEditingEventId, deleteEvent]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // Render
  const showTime = heightLevel !== 'micro' && heightLevel !== 'tiny';
  const showEndTime = heightLevel === 'large' || heightLevel === 'medium';
  const showCheckbox = heightLevel !== 'micro';

  const isOvertime = elapsedMs > plannedDuration;
  const fillPercent = isTimerActive
    ? Math.min((elapsedMs / plannedDuration) * 100, 100)
    : 0;

  return (
    <>
      <div
        ref={blockRef}
        style={{
          top: `${top}px`,
          height: `${Math.max(height, 18)}px`,
          left: positioning.left,
          width: positioning.width,
          zIndex,
        }}
        className={`absolute ${cursorClass} select-none`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => {
          setIsHovered(true);
          const startMinutes = event.dtstart.getHours() * 60 + event.dtstart.getMinutes();
          const endMinutes = event.dtend.getHours() * 60 + event.dtend.getMinutes();
          onHover?.(startMinutes, endMinutes);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          if (!isDragging) {
            setResizeEdge(null);
          }
          onHover?.(null, null);
        }}
        onContextMenu={handleContextMenu}
      >
        <div
          className={`
            w-full h-full flex flex-col relative overflow-hidden
            ${isTimerActive && !isCompleted ? 'opacity-60' : ''}
            rounded-[5px]
            transition-shadow duration-200 ease-out
            ${shadowClass}
          `}
          style={{
            backgroundColor: bgColor,
            opacity: isCompleted ? 0.6 : 1,
            ...(isActive ? { boxShadow: `0 0 0 2px ${ringColor}` } : {}),
            ...(isHovered && !isActive ? { boxShadow: `0 0 0 1px ${ringColor}` } : {}),
          }}
        >
          {/* Accent bar */}
          <div
            className={`absolute left-1 top-1 bottom-1 w-[3px] rounded-full ${isTimerActive && !isCompleted ? 'opacity-60' : ''}`}
            style={{ backgroundColor: colorStyles.accent }}
          />

          {/* Timer fill layer */}
          {isTimerActive && !isCompleted && (
            <div
              className="absolute inset-0 transition-all duration-1000 ease-linear rounded-[4px]"
              style={{
                backgroundColor: fillColor,
                height: `${fillPercent}%`,
                opacity: 1,
              }}
            />
          )}

          {/* Overtime divider */}
          {isOvertime && (
            <div
              className="absolute left-0 right-0 border-t-2"
              style={{
                top: `${plannedHeight}px`,
                borderColor: colorStyles.accent,
              }}
            />
          )}

          {/* Icon watermark */}
          {heightLevel !== 'micro' && heightLevel !== 'tiny' && (() => {
            const isPreviewing = universalPreviewTarget === event.uid;
            
            const displayIconName = (isPreviewing && universalPreviewIcon !== null)
              ? universalPreviewIcon
              : event.icon;
            
            if (!displayIconName) return null;
            
            // Size Logic: Absolute Pixels (Preview > Event > Auto)
            let iconSize: number;
            if (isPreviewing && universalPreviewIconSize) {
                iconSize = universalPreviewIconSize;
            } else if (event.iconSize) {
                iconSize = event.iconSize;
            } else {
                // Default auto calculation
                iconSize = Math.min(Math.max(hourHeight * 0.7, 24), 80);
            }
            
            return (
              <div
                className="absolute right-1 bottom-0 pointer-events-none transition-all duration-200"
                style={{
                  opacity: 1, // Keep your "True Color" preference
                  color: colorStyles.accent, 
                }}
              >
                <AppIcon
                  icon={displayIconName}
                  size={iconSize}
                  color={colorStyles.accent}
                />
              </div>
            );
          })()}

          {/* Content layer */}
          <div className={`relative z-10 flex items-start gap-1.5 pl-3 pr-2 py-1 ${heightLevel === 'tiny' ? 'items-center' : ''}`}>
            {showCheckbox && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle?.(event.uid);
                }}
                className={`
                  flex-shrink-0 w-3.5 h-3.5 rounded-[4px] border-2 flex items-center justify-center mt-0.5
                  ${isCompleted
                    ? ''
                    : 'bg-white/50 dark:bg-zinc-800/50'
                  }
                `}
                style={{
                  borderColor: colorStyles.accent,
                  backgroundColor: isCompleted ? colorStyles.accent : undefined,
                }}
              >
                {isCompleted && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </button>
            )}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-1">
                {isTimerPaused && <Pause className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />}
                <p
                  className={`font-medium leading-tight truncate ${isCompleted ? 'line-through opacity-60' : ''} ${heightLevel === 'micro' ? 'text-[9px]' : 'text-[11px]'}`}
                  style={{ color: textColor }}
                >
                  {event.summary || 'Untitled'}
                </p>
              </div>
              {showTime && (
                <p
                  className={`mt-0.5 tabular-nums font-medium opacity-70 ${heightLevel === 'small' ? 'text-[8px]' : 'text-[9px]'}`}
                  style={{ color: textColor }}
                >
                  {isTimerActive ? (
                    <>
                      <span className={isOvertime ? 'text-red-500' : ''}>
                        {formatElapsedTime(elapsedMs)}
                      </span>
                      <span className="opacity-50"> / {formatElapsedTime(plannedDuration)}</span>
                    </>
                  ) : (
                    <>
                      {use24Hour ? format(event.dtstart, 'H:mm') : format(event.dtstart, 'h:mma').toLowerCase()}
                      {showEndTime && ` - ${use24Hour ? format(event.dtend, 'H:mm') : format(event.dtend, 'h:mma').toLowerCase()}`}
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {contextMenu && (
        <EventContextMenu
          eventId={event.uid}
          position={contextMenu}
          currentColor={event.color}
          currentIcon={event.icon}
          timerState={event.timerState}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}