import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { NOTES_COLORS } from '@/lib/utils';
import { SPRING_PREMIUM } from '@/lib/animations';
import { useShellSidebarResize } from './useShellSidebarResize';
import { RESIZE_HANDLE_HALF_WIDTH } from './ResizeDividerVisual';
import { ResizeHandle } from './ResizeHandle';

interface UnifiedSidebarContainerProps {
  children: ReactNode;
  width: number;
  collapsed: boolean;
  onWidthChange: (width: number) => void;
  backgroundColor?: string;
}

export function UnifiedSidebarContainer({
  children,
  width,
  collapsed,
  onWidthChange,
  backgroundColor = NOTES_COLORS.sidebarBg,
}: UnifiedSidebarContainerProps) {
  const { isDragging, handleDragStart } = useShellSidebarResize({
    width,
    onWidthChange,
  });

  return (
    <>
      <motion.aside
        initial={false}
        animate={{
          width: collapsed ? 0 : width,
          opacity: 1
        }}
        transition={SPRING_PREMIUM}
        className="flex-shrink-0 flex flex-col overflow-hidden select-none relative z-20 neko-scrollbar"
        style={{ backgroundColor }}
      >
        {children}
      </motion.aside>

      {!collapsed && (
        <>
          <div
            className="w-px flex-shrink-0 z-20"
            style={{ backgroundColor: NOTES_COLORS.divider }}
          />
          <ResizeHandle
            onMouseDown={handleDragStart}
            isDragging={isDragging}
            tooltipSide="right"
            shortcutKeys={['Ctrl', '\\']}
            positionStyle={{
              left: width - RESIZE_HANDLE_HALF_WIDTH,
              pointerEvents: 'auto',
            }}
          />
        </>
      )}
    </>
  );
}
