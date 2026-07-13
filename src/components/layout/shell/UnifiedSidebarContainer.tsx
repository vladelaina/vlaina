import { useRef, type FocusEvent, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/utils';
import { useShellSidebarResize } from './useShellSidebarResize';
import { RESIZE_HANDLE_HALF_WIDTH } from './ResizeDividerVisual';
import { ResizeHandle } from './ResizeHandle';

interface UnifiedSidebarContainerProps {
  children: ReactNode;
  width: number;
  collapsed: boolean;
  peeking?: boolean;
  onPeekChange?: (peeking: boolean) => void;
  onWidthChange: (width: number) => void;
  onLiveWidthChange?: (width: number) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  widthScopeRef?: Ref<HTMLDivElement>;
  backgroundColor?: string;
}

export function UnifiedSidebarContainer({
  children,
  width,
  collapsed,
  peeking = false,
  onPeekChange,
  onWidthChange,
  onLiveWidthChange,
  onDragStateChange,
  widthScopeRef,
  backgroundColor = 'transparent',
}: UnifiedSidebarContainerProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const { isDragging, handleDragStart } = useShellSidebarResize({
    width,
    onWidthChange: onLiveWidthChange ?? onWidthChange,
    onWidthCommit: onLiveWidthChange ? onWidthChange : undefined,
    onDragStateChange,
  });

  const handleMouseLeave = () => {
    if (!document.hasFocus()) return;

    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement
      && sidebarRef.current?.contains(activeElement)
      && activeElement.matches('input, textarea, select, [contenteditable="true"]')
    ) {
      return;
    }

    onPeekChange?.(false);
  };

  const handleFocusOut = (event: FocusEvent<HTMLElement>) => {
    if (!document.hasFocus()) return;

    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    onPeekChange?.(false);
  };

  return (
    <div
      ref={widthScopeRef}
      data-shell-sidebar-width-scope="true"
      style={{ display: 'contents' }}
    >
      <aside
        ref={sidebarRef}
        data-shell-sidebar-peek={collapsed ? 'true' : undefined}
        data-open={collapsed ? (peeking ? 'true' : 'false') : undefined}
        aria-hidden={collapsed ? !peeking : undefined}
        className={cn(
          'flex min-h-0 flex-col overflow-hidden select-none app-scrollbar',
          isDragging && 'will-change-[width]',
          collapsed
            ? cn(
              'absolute inset-y-0 left-0 z-[var(--vlaina-z-40)] transition-[opacity,transform] duration-[var(--vlaina-duration-100)] ease-out',
              peeking
                ? 'translate-x-0 opacity-[var(--vlaina-opacity-100)] pointer-events-auto'
                : '-translate-x-full opacity-[var(--vlaina-opacity-0)] pointer-events-none',
            )
            : 'relative z-[var(--vlaina-z-20)] flex-shrink-0',
          !collapsed && !isDragging && 'transition-[width] duration-[var(--vlaina-duration-100)] ease-out',
        )}
        style={{
          backgroundColor,
          width: 'var(--vlaina-shell-sidebar-width)',
        }}
        onMouseEnter={collapsed ? () => onPeekChange?.(true) : undefined}
        onMouseLeave={collapsed ? handleMouseLeave : undefined}
        onBlur={collapsed ? handleFocusOut : undefined}
      >
        {children}
      </aside>

      {!collapsed && (
        <>
          <ResizeHandle
            dataResizeHandleScope="shell-sidebar"
            onMouseDown={handleDragStart}
            isDragging={isDragging}
            positionStyle={{
              left: `calc(var(--vlaina-shell-sidebar-width) - ${RESIZE_HANDLE_HALF_WIDTH}px)`,
              pointerEvents: 'auto',
            }}
          />
        </>
      )}
    </div>
  );
}
