import { ReactNode } from 'react';
import { cn, NOTES_COLORS } from '@/lib/utils';
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
  backgroundColor = NOTES_COLORS.sidebarBg,
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
          'flex-shrink-0 flex flex-col overflow-hidden select-none relative z-20 neko-scrollbar',
          isDragging && 'will-change-[width]',
          !isDragging && 'transition-[width] duration-200 ease-out',
        )}
        style={{
          backgroundColor,
          width: collapsed ? 0 : 'var(--neko-shell-sidebar-width)',
        }}
      >
        {children}
      </aside>

      {!collapsed && (
        <>
          <div
            className="w-px flex-shrink-0 z-20"
            style={{ backgroundColor: NOTES_COLORS.divider }}
          />
          <ResizeHandle
            onMouseDown={handleDragStart}
            isDragging={isDragging}
            positionStyle={{
              left: `calc(var(--neko-shell-sidebar-width) - ${RESIZE_HANDLE_HALF_WIDTH}px)`,
              pointerEvents: 'auto',
            }}
          />
        </>
      )}
    </>
  );
}
