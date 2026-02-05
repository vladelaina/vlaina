import { useRef } from 'react';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { EventContextMenu } from './EventContextMenu';
import { EventContent } from './EventContent';
import { EventVisualLayers } from './EventVisualLayers';
import { type EventLayoutInfo } from '../../utils/eventLayout';
import type { NekoEvent } from '@/lib/ics/types';
import { calculateEventTop, calculateEventHeight, DEFAULT_DAY_START_MINUTES } from '../../utils/timeUtils';
import { useEventTimer, getHeightLevel } from './hooks/useEventTimer';
import { useEventStyles } from './hooks/useEventStyles';
import { useEventInteraction } from './hooks/useEventInteraction';

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
    editingEventId,
    use24Hour,
    universalPreviewColor,
    universalPreviewTarget,
  } = useCalendarStore();

  const blockRef = useRef<HTMLDivElement>(null);
  const isActive = editingEventId === event.uid;
  const isCompleted = event.completed ?? false;

  const startDate = event.dtstart.getTime();
  const endDate = event.dtend.getTime();
  const top = calculateEventTop(startDate, hourHeight, dayStartMinutes);
  const plannedDuration = endDate - startDate;
  const plannedHeight = calculateEventHeight(startDate, endDate, hourHeight);

  const { elapsedMs, isTimerActive, isTimerPaused, actualHeight } = useEventTimer({
    event,
    plannedHeight,
    hourHeight,
  });

  const height = actualHeight;
  const heightLevel = getHeightLevel(height);

  // 只有当前事件才应用预览颜色
  const isPreviewing = universalPreviewTarget === event.uid;
  const displayColor = (isPreviewing && universalPreviewColor !== null && universalPreviewColor !== undefined)
    ? universalPreviewColor
    : event.color;

  const {
    contextMenu,
    setContextMenu,
    isHovered,
    resizeEdge,
    isDragging,
    handleMouseMove,
    handleMouseDown,
    handleClick,
    handleContextMenu,
    handleMouseEnter,
    handleMouseLeave,
  } = useEventInteraction({
    eventId: event.uid,
    onDragStart,
    onHover,
    eventStart: event.dtstart,
    eventEnd: event.dtend,
  });

  const { colors, positioning, zIndex, shadowClass, cursorClass } = useEventStyles({
    displayColor: displayColor || '',
    layout,
    isActive,
    isHovered,
    isDragging,
    resizeEdge,
  });

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
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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
            backgroundColor: colors.bg,
            opacity: isCompleted ? 0.6 : 1,
            transition: 'box-shadow 0.2s ease-out', // 只过渡 shadow，不过渡颜色
            ...(isActive ? { boxShadow: `0 0 0 2px ${colors.ring}` } : {}),
            ...(isHovered && !isActive ? { boxShadow: `0 0 0 1px ${colors.ring}` } : {}),
          }}
        >
          <EventVisualLayers
            event={event}
            colorStyles={{ accent: colors.accent, fill: colors.fill }}
            isTimerActive={isTimerActive}
            isCompleted={isCompleted}
            fillPercent={fillPercent}
            isOvertime={isOvertime}
            plannedHeight={plannedHeight}
            heightLevel={heightLevel}
            hourHeight={hourHeight}
          />

          <EventContent
            event={event}
            colorStyles={{ accent: colors.accent, text: colors.text }}
            isCompleted={isCompleted}
            isTimerActive={isTimerActive}
            isTimerPaused={isTimerPaused}
            elapsedMs={elapsedMs}
            plannedDuration={plannedDuration}
            isOvertime={isOvertime}
            heightLevel={heightLevel}
            use24Hour={use24Hour}
            onToggle={onToggle}
          />
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