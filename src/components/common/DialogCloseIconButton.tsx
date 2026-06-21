import { ComponentProps, forwardRef } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export const dialogCloseIconButtonClassName = [
  'app-no-drag inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent text-[var(--vlaina-sidebar-notes-text-soft)] shadow-[var(--vlaina-shadow-none)]',
  'transition-[background-color,color,box-shadow,transform] duration-[var(--vlaina-duration-150)]',
  'hover:bg-[var(--vlaina-color-pill-surface)] hover:text-[var(--vlaina-sidebar-row-selected-text)] hover:shadow-[var(--vlaina-shadow-menu-hover)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vlaina-color-sidebar-focus-ring)]',
].join(' ');

interface DialogCloseIconButtonProps extends ComponentProps<'button'> {
  label: string;
  iconSize?: ComponentProps<typeof Icon>['size'];
}

export const DialogCloseIconButton = forwardRef<HTMLButtonElement, DialogCloseIconButtonProps>(
  ({ className, label, iconSize = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(dialogCloseIconButtonClassName, className)}
      {...props}
    >
      <Icon name="common.close" size={iconSize} />
      <span className="sr-only">{label}</span>
    </button>
  ),
);

DialogCloseIconButton.displayName = 'DialogCloseIconButton';
