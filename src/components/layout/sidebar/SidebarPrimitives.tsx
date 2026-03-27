import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Icon } from '@/components/ui/icons';
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area';
import { cn } from '@/lib/utils';

interface SidebarSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  isPeeking?: boolean;
}

interface SidebarScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string;
}

interface SidebarActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: ReactNode;
  iconClassName?: string;
}

interface SidebarSearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  onClose: () => void;
  closeLabel: string;
  containerClassName?: string;
  inputClassName?: string;
  closeButtonClassName?: string;
}

export const SidebarSurface = forwardRef<HTMLDivElement, SidebarSurfaceProps>(
  function SidebarSurface({ className, isPeeking = false, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex h-full flex-col', isPeeking && 'opacity-95', className)}
        {...props}
      />
    );
  },
);

export const SidebarScrollArea = forwardRef<HTMLDivElement, SidebarScrollAreaProps>(
  function SidebarScrollArea({ onMouseEnter, className, viewportClassName, ...props }, ref) {
    return (
      <OverlayScrollArea
        ref={ref}
        scrollbarVariant="compact"
        viewportClassName={cn('px-2 py-2', viewportClassName, className)}
        onMouseEnter={onMouseEnter}
        {...props}
      />
    );
  },
);

export function SidebarList({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-0.5', className)} {...props} />;
}

export function SidebarActionGroup({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-1 pt-1 pb-1 space-y-1', className)} {...props} />;
}

export const SidebarActionButton = forwardRef<HTMLButtonElement, SidebarActionButtonProps>(
  function SidebarActionButton(
    { icon, label, className, iconClassName, type = 'button', ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'flex h-[30px] w-full cursor-pointer items-center gap-2 rounded-md bg-transparent px-3 py-1 text-sm font-medium shadow-none transition-colors hover:shadow-none',
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            'flex size-[20px] shrink-0 items-center justify-center',
            iconClassName,
          )}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </button>
    );
  },
);

export const SidebarSearchField = forwardRef<HTMLInputElement, SidebarSearchFieldProps>(
  function SidebarSearchField(
    {
      onClose,
      closeLabel,
      containerClassName,
      inputClassName,
      closeButtonClassName,
      className,
      ...props
    },
    ref,
  ) {
    return (
      <div className={cn('px-2 pt-2', className)}>
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border border-[var(--vlaina-border)] bg-white px-3 py-1 shadow-none',
            containerClassName,
          )}
        >
          <Icon
            name="common.search"
            size="md"
            className="text-[var(--vlaina-text-tertiary)]"
          />
          <input
            ref={ref}
            className={cn(
              'min-w-0 flex-1 bg-transparent text-[13px] text-[var(--vlaina-text-primary)] outline-none placeholder:text-[var(--vlaina-text-tertiary)]',
              inputClassName,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--vlaina-text-tertiary)] transition-colors hover:bg-[var(--vlaina-hover)] hover:text-[var(--vlaina-text-primary)]',
              closeButtonClassName,
            )}
          >
            <Icon name="common.close" size="md" />
          </button>
        </div>
      </div>
    );
  },
);
