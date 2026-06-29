import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { chatComposerGhostIconButtonClass } from '@/components/Chat/features/Input/composerStyles';
import { useI18n } from '@/lib/i18n';

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
  const { t } = useI18n();

  return (
    <div
      className={cn(
        'flex items-center text-xs font-medium text-[var(--vlaina-text-tertiary)] transition-colors hover:text-[var(--vlaina-text-primary)]',
        className,
      )}
    >
      <button
        type="button"
        aria-label={t('chat.previousMessageVersion')}
        onClick={onPrevious}
        disabled={previousDisabled}
        className={cn(
          'grid h-6 w-6 place-items-center text-[var(--vlaina-sidebar-chat-text)] disabled:opacity-[var(--vlaina-opacity-30)] disabled:hover:bg-transparent disabled:hover:shadow-none disabled:hover:text-[var(--vlaina-sidebar-chat-text)]',
          iconButtonStyles,
          chatComposerGhostIconButtonClass,
        )}
      >
        <Icon name="nav.chevronLeft" size="md" />
      </button>
      <span className="mx-1 font-mono">{current}/{total}</span>
      <button
        type="button"
        aria-label={t('chat.nextMessageVersion')}
        onClick={onNext}
        disabled={nextDisabled}
        className={cn(
          'grid h-6 w-6 place-items-center text-[var(--vlaina-sidebar-chat-text)] disabled:opacity-[var(--vlaina-opacity-30)] disabled:hover:bg-transparent disabled:hover:shadow-none disabled:hover:text-[var(--vlaina-sidebar-chat-text)]',
          iconButtonStyles,
          chatComposerGhostIconButtonClass,
        )}
      >
        <Icon name="nav.chevronRight" size="md" />
      </button>
    </div>
  );
}
