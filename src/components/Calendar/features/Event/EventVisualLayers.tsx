import { AppIcon } from '@/components/common/AppIcon';
import { useCalendarStore } from '@/stores/useCalendarStore';
import type { NekoEvent } from '@/lib/ics/types';

interface EventVisualLayersProps {
  event: NekoEvent;
  colorStyles: {
    accent: string;
    fill: string;
  };
  isTimerActive: boolean;
  isCompleted: boolean;
  fillPercent: number;
  isOvertime: boolean;
  plannedHeight: number;
  heightLevel: string;
  hourHeight: number;
}

export function EventVisualLayers({
  event,
  colorStyles,
  isTimerActive,
  isCompleted,
  fillPercent,
  isOvertime,
  plannedHeight,
  heightLevel,
  hourHeight,
}: EventVisualLayersProps) {
  const { universalPreviewTarget, universalPreviewIcon, universalPreviewIconSize } = useCalendarStore();

  const showIcon = heightLevel !== 'micro' && heightLevel !== 'tiny';
  const isPreviewing = universalPreviewTarget === event.uid;
  const displayIconName = (isPreviewing && universalPreviewIcon !== null)
    ? universalPreviewIcon
    : event.icon;

  let iconSize: number | undefined;
  if (displayIconName) {
    if (isPreviewing && universalPreviewIconSize) {
      iconSize = universalPreviewIconSize;
    } else if (event.iconSize) {
      iconSize = event.iconSize;
    } else {
      iconSize = Math.min(Math.max(hourHeight * 0.7, 24), 80);
    }
  }

  return (
    <>
      <div
        className={`absolute left-1 top-1 bottom-1 w-[3px] rounded-full ${isTimerActive && !isCompleted ? 'opacity-60' : ''}`}
        style={{ backgroundColor: colorStyles.accent }}
      />

      {isTimerActive && !isCompleted && (
        <div
          className="absolute inset-0 transition-all duration-1000 ease-linear rounded-[4px]"
          style={{
            backgroundColor: colorStyles.fill,
            height: `${fillPercent}%`,
            opacity: 1,
          }}
        />
      )}

      {isOvertime && (
        <div
          className="absolute left-0 right-0 border-t-2"
          style={{
            top: `${plannedHeight}px`,
            borderColor: colorStyles.accent,
          }}
        />
      )}

      {showIcon && displayIconName && (
        <div
          className="absolute right-1 bottom-0 pointer-events-none transition-all duration-200"
          style={{
            opacity: 1,
            color: colorStyles.accent,
          }}
        >
          <AppIcon
            icon={displayIconName}
            size={iconSize!}
            color={colorStyles.accent}
          />
        </div>
      )}
    </>
  );
}
