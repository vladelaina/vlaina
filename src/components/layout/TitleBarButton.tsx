import { cn } from '@/lib/utils';
import { ComponentType } from 'react';

interface TitleBarButtonProps {
  icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
  isActive?: boolean;
  className?: string;
}

export function TitleBarButton({ icon: Icon, onClick, isActive, className }: TitleBarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-full px-3 flex items-center justify-center transition-colors",
        isActive
          ? "text-zinc-500 dark:text-zinc-400"
          : "text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400",
        className
      )}
    >
      <Icon className="size-[18px]" />
    </button>
  );
}
