import { Icon } from '@/components/ui/icons';
import { IconSize } from '@/components/ui/icons/sizes';
import { cn } from '@/lib/utils';

interface ToggleIconProps {
  expanded: boolean;
  size: number | string | IconSize;
  className?: string;
}

export function ToggleIcon({ expanded, size, className }: ToggleIconProps) {
  return (
    <div className={cn("transition-transform duration-200", expanded ? "rotate-90" : "", className)}>
      <Icon name="nav.chevronRight" size={size} />
    </div>
  );
}