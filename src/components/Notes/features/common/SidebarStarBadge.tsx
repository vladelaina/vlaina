import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { MouseEvent, PointerEvent } from 'react';

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
  const stopRowInteraction = (
    event: MouseEvent<HTMLButtonElement> | PointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={stopRowInteraction}
      onMouseDown={stopRowInteraction}
      onClick={(event) => {
        stopRowInteraction(event);
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
