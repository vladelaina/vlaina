import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

interface SidebarStarBadgeProps {
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}

export function SidebarStarBadge({
  onClick,
  className,
  ariaLabel = 'Remove from Starred',
}: SidebarStarBadgeProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'absolute right-0 top-0 z-30 flex h-4 w-4 cursor-pointer items-center justify-center text-amber-500 opacity-100 hover:opacity-100 focus-visible:opacity-100',
        className,
      )}
    >
      <Icon name="misc.star" size="sm" className="fill-current" />
    </button>
  );
}
