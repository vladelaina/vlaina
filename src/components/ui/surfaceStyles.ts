import { ghostIconButtonStyles } from '@/lib/utils';

export const raisedPillSurfaceClass = [
  'border !border-transparent !bg-[var(--vlaina-color-pill-surface)]',
  '!shadow-[var(--vlaina-shadow-raised-soft)]',
  'hover:!shadow-[var(--vlaina-shadow-menu-hover)]',
].join(' ');

export const raisedPopoverSurfaceClass = [
  raisedPillSurfaceClass,
  'floating-popover-shadow',
].join(' ');

export const ghostIconButtonClass = ghostIconButtonStyles;

export const secondaryPillButtonClass = [
  'h-9 px-4 rounded-full',
  'bg-[var(--vlaina-bg-tertiary)]',
  'text-[var(--vlaina-text-primary)]',
  'hover:bg-[var(--vlaina-hover-filled)]',
  'transition-colors',
].join(' ');
