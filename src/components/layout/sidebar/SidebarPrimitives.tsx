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
import {
  getSidebarActionButtonClass,
  type SidebarTone,
} from '@/components/layout/sidebar/sidebarLabelStyles';

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
  tone?: SidebarTone;
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
        data-sidebar-scroll-root="true"
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
    { icon, label, className, iconClassName, tone, type = 'button', ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'flex h-[30px] w-full cursor-pointer items-center gap-2 rounded-md bg-transparent px-3 py-1 text-sm shadow-none transition-colors hover:shadow-none',
          tone ? getSidebarActionButtonClass(tone) : undefined,
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

const SIDEBAR_SEARCH_ICON_SIZE = 18;

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
            'flex h-[40px] items-center gap-2 rounded-md border border-transparent bg-[#f8f8f8] pl-3 pr-1 shadow-none',
            containerClassName,
          )}
        >
          <Icon
            name="common.search"
            size={SIDEBAR_SEARCH_ICON_SIZE}
            className="text-[#999999]"
          />
          <input
            ref={ref}
            spellCheck={false}
            className={cn(
              'min-w-0 flex-1 bg-transparent text-[13px] text-[#999999] outline-none placeholder:text-[#999999]',
              inputClassName,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className={cn(
              'inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[#999999] transition-colors hover:bg-[var(--notes-sidebar-row-hover)] hover:text-[#27262b]',
              closeButtonClassName,
            )}
          >
            <Icon name="common.close" size="sm" />
          </button>
        </div>
      </div>
    );
  },
);
