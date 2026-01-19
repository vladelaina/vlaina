import * as React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn, iconButtonStyles } from '@/lib/utils';

interface IconButtonProps {
  icon: React.ReactNode;
  tooltip?: string;
  onClick: () => void;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function IconButton({
  icon,
  tooltip,
  onClick,
  className,
  side = 'bottom',
}: IconButtonProps) {
  const button = (
    <button
      onClick={onClick}
      className={cn("p-1", iconButtonStyles, className)}
    >
      {icon}
    </button>
  );

  // If no tooltip, just render the button
  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {button}
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={4}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
