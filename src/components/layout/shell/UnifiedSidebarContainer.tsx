import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useShellSidebarResize } from './useShellSidebarResize';
import { RESIZE_HANDLE_HALF_WIDTH } from './ResizeDividerVisual';
import { ResizeHandle } from './ResizeHandle';

interface UnifiedSidebarContainerProps {
  children: ReactNode;
  width: number;
  collapsed: boolean;
  onWidthChange: (width: number) => void;
  onLiveWidthChange?: (width: number) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  backgroundColor?: string;
}

export function UnifiedSidebarContainer({
  children,
  width,
  collapsed,
  onWidthChange,
  onLiveWidthChange,
  onDragStateChange,
  backgroundColor = 'var(--vlaina-color-surface-shell-sidebar)',
}: UnifiedSidebarContainerProps) {
  const { isDragging, handleDragStart } = useShellSidebarResize({
    width,
    onWidthChange: onLiveWidthChange ?? onWidthChange,
    onWidthCommit: onLiveWidthChange ? onWidthChange : undefined,
    onDragStateChange,
  });

  return (
    <>
      <aside
        className={cn(
          'flex-shrink-0 flex min-h-0 flex-col overflow-hidden select-none relative z-[var(--vlaina-z-20)] app-scrollbar',
          isDragging && 'will-change-[width]',
          !isDragging && 'transition-[width] duration-[var(--vlaina-duration-200)] ease-out',
        )}
        style={{
          backgroundColor,
          width: collapsed ? 0 : 'var(--vlaina-shell-sidebar-width)',
        }}
      >
        {children}
      </aside>

      {!collapsed && (
        <>
          <ResizeHandle
            onMouseDown={handleDragStart}
            isDragging={isDragging}
            positionStyle={{
              left: `calc(var(--vlaina-shell-sidebar-width) - ${RESIZE_HANDLE_HALF_WIDTH}px)`,
              pointerEvents: 'auto',
            }}
          />
        </>
      )}
    </>
  );
}
