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
        'flex items-center text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-200',
        className,
      )}
    >
      <button
        type="button"
        aria-label="Previous message version"
        onClick={onPrevious}
        disabled={previousDisabled}
        className={cn('grid h-6 w-6 place-items-center rounded-full disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5', iconButtonStyles)}
      >
        <Icon name="nav.chevronLeft" size="md" />
      </button>
      <span className="mx-1 font-mono">{current}/{total}</span>
      <button
        type="button"
        aria-label="Next message version"
        onClick={onNext}
        disabled={nextDisabled}
        className={cn('grid h-6 w-6 place-items-center rounded-full disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5', iconButtonStyles)}
      >
        <Icon name="nav.chevronRight" size="md" />
      </button>
    </div>
  );
}
