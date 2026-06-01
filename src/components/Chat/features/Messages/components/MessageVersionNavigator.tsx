import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';

interface MessageVersionNavigatorProps {
  current: number;
  total: number;
  previousDisabled: boolean;
  nextDisabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
}

export function MessageVersionNavigator({
  current,
  total,
  previousDisabled,
  nextDisabled,
  onPrevious,
  onNext,
  className,
}: MessageVersionNavigatorProps) {
  return (
    <div
      className={cn(
        'flex items-center text-xs font-medium text-[var(--vlaina-text-tertiary)] transition-colors hover:text-[var(--vlaina-text-primary)]',
        className,
      )}
    >
      <button
        type="button"
        aria-label="Previous message version"
        onClick={onPrevious}
        disabled={previousDisabled}
        className={cn('grid h-6 w-6 place-items-center rounded-full disabled:opacity-[var(--vlaina-opacity-30)] hover:bg-[var(--vlaina-color-control-hover-bg)]', iconButtonStyles)}
      >
        <Icon name="nav.chevronLeft" size="md" />
      </button>
      <span className="mx-1 font-mono">{current}/{total}</span>
      <button
        type="button"
        aria-label="Next message version"
        onClick={onNext}
        disabled={nextDisabled}
        className={cn('grid h-6 w-6 place-items-center rounded-full disabled:opacity-[var(--vlaina-opacity-30)] hover:bg-[var(--vlaina-color-control-hover-bg)]', iconButtonStyles)}
      >
        <Icon name="nav.chevronRight" size="md" />
      </button>
    </div>
  );
}
