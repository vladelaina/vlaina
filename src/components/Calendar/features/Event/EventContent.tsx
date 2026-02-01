import { format } from 'date-fns';
import { MdCheck, MdPause } from 'react-icons/md';
import type { NekoEvent } from '@/lib/ics/types';
import { formatElapsedTime } from './hooks/useEventTimer';

interface EventContentProps {
  event: NekoEvent;
  colorStyles: {
    accent: string;
    text: string;
  };
  isCompleted: boolean;
  isTimerActive: boolean;
  isTimerPaused: boolean;
  elapsedMs: number;
  plannedDuration: number;
  isOvertime: boolean;
  heightLevel: string;
  use24Hour: boolean;
  onToggle?: (id: string) => void;
}

export function EventContent({
  event,
  colorStyles,
  isCompleted,
  isTimerActive,
  isTimerPaused,
  elapsedMs,
  plannedDuration,
  isOvertime,
  heightLevel,
  use24Hour,
  onToggle,
}: EventContentProps) {
  const showTime = heightLevel !== 'micro' && heightLevel !== 'tiny';
  const showEndTime = heightLevel === 'large' || heightLevel === 'medium';
  const showCheckbox = heightLevel !== 'micro';

  return (
    <div className={`relative z-10 flex items-start gap-1.5 pl-3 pr-2 py-1 ${heightLevel === 'tiny' ? 'items-center' : ''}`}>
      {showCheckbox && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.(event.uid);
          }}
          className={`
            flex-shrink-0 w-[18px] h-[18px] rounded-[4px] border-2 flex items-center justify-center mt-0.5
            ${isCompleted ? '' : 'bg-white/50 dark:bg-zinc-800/50'}
          `}
          style={{
            borderColor: colorStyles.accent,
            backgroundColor: isCompleted ? colorStyles.accent : undefined,
          }}
        >
          {isCompleted && <MdCheck className="w-2.5 h-2.5 text-white" />}
        </button>
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-start gap-1">
          {isTimerPaused && <MdPause className="w-2.5 h-2.5 flex-shrink-0 opacity-70 mt-0.5" />}
          <p
            className={`font-medium leading-tight whitespace-normal break-words ${isCompleted ? 'line-through opacity-60' : ''} ${heightLevel === 'micro' ? 'text-[9px]' : 'text-[11px]'}`}
            style={{ color: colorStyles.text }}
          >
            {event.summary || 'Untitled'}
          </p>
        </div>
        {showTime && (
          <p
            className={`mt-0.5 tabular-nums font-medium opacity-70 ${heightLevel === 'small' ? 'text-[8px]' : 'text-[9px]'}`}
            style={{ color: colorStyles.text }}
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
  );
}
