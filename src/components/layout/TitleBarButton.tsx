import { cn } from '@/lib/utils';
import { ComponentType } from 'react';
import { themeIconTokens } from '@/styles/themeTokens';

interface TitleBarButtonProps {
  icon: ComponentType<{ className?: string; size?: number | string }>;
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
          ? "text-[var(--vlaina-color-titlebar-button-active)]"
          : "text-[var(--vlaina-color-titlebar-button)] hover:text-[var(--vlaina-color-titlebar-button-hover)]",
        className
      )}
    >
      <Icon size={themeIconTokens.sizeCompact} />
    </button>
  );
}
