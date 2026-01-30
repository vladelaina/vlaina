/**
 * ToggleIcon - Reusable toggle triangle icon
 */

import { cn } from '@/lib/utils';

interface ToggleIconProps {
  expanded?: boolean;
  size: number;
  className?: string;
}

export function ToggleIcon({ expanded = true, size, className }: ToggleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn(
        "transition-transform duration-150",
        !expanded && "-rotate-90",
        className
      )}
    >
      <path d="M13.15 15.132a.757.757 0 0 1-1.3 0L8.602 9.605c-.29-.491.072-1.105.65-1.105h6.497c.577 0 .938.614.65 1.105z" />
    </svg>
  );
}