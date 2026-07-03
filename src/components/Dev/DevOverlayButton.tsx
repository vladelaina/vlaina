import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon, type IconName } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';

const DEV_OVERLAY_BUTTON_CLASS =
  'app-no-drag pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border border-[var(--vlaina-border)] bg-[var(--vlaina-color-setting-field)] shadow-[var(--vlaina-shadow-sm)] backdrop-blur-[var(--vlaina-backdrop-blur-sm)] transition-colors hover:bg-[var(--vlaina-hover)] disabled:opacity-[var(--vlaina-opacity-50)]';

export function DevOverlayButton({
  children,
  disabled = false,
  iconName,
  label,
  onClick,
}: {
  children?: ReactNode;
  disabled?: boolean;
  iconName: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(DEV_OVERLAY_BUTTON_CLASS, iconButtonStyles)}
        >
          {children ?? <Icon name={iconName} size="md" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        <span className="text-[var(--vlaina-font-xs)]">{label}</span>
      </TooltipContent>
    </Tooltip>
  );
}
