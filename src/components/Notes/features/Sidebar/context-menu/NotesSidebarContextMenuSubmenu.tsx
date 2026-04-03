import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { MENU_PANEL_CLASS_NAME, resolveSubmenuLayout } from './shared';

interface NotesSidebarContextMenuSubmenuProps {
  icon: ReactNode;
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

export function NotesSidebarContextMenuSubmenu({
  icon,
  label,
  children,
  className,
}: NotesSidebarContextMenuSubmenuProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState({ top: 0, left: 0 });
  const [openLeft, setOpenLeft] = useState(false);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSubmenuPosition({ top: 0, left: 0 });
      setOpenLeft(false);
    }
  }, [isOpen]);

  const openMenu = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsOpen(true);
  };

  const scheduleCloseMenu = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, 120);
  };

  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current || !submenuRef.current) {
      return;
    }

    const submenuElement = submenuRef.current;
    let frameId = 0;

    const updatePosition = () => {
      const triggerRect = containerRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      const nextLayout = resolveSubmenuLayout(triggerRect, submenuElement);
      setOpenLeft((current) => (current === nextLayout.openLeft ? current : nextLayout.openLeft));
      setSubmenuPosition((current) =>
        current.top === nextLayout.position.top && current.left === nextLayout.position.left
          ? current
          : nextLayout.position,
      );
    };

    updatePosition();
    frameId = window.requestAnimationFrame(updatePosition);

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            updatePosition();
          });

    resizeObserver?.observe(submenuElement);
    window.addEventListener('resize', updatePosition);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleCloseMenu}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          openMenu();
        }}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-[var(--notes-sidebar-text)] outline-none transition-colors hover:bg-[var(--notes-sidebar-row-hover)]"
      >
        <span className="flex size-[20px] items-center justify-center text-[var(--notes-sidebar-icon)]">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <span className="shrink-0 text-[var(--notes-sidebar-icon)]">
          <span className="flex size-[20px] items-center justify-center">
            <span aria-hidden="true">›</span>
          </span>
        </span>
      </button>
      {isOpen
        ? createPortal(
            <div
              ref={submenuRef}
              data-notes-sidebar-context-menu-layer="true"
              className={cn('fixed z-[10000] max-h-[calc(100vh-16px)]', MENU_PANEL_CLASS_NAME)}
              style={{
                top: submenuPosition.top,
                left: submenuPosition.left,
                transformOrigin: openLeft ? 'top right' : 'top left',
              }}
              onMouseEnter={openMenu}
              onMouseLeave={scheduleCloseMenu}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.stopPropagation()}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
