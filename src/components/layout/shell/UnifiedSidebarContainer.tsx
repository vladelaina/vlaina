import { ReactNode, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NOTES_COLORS } from '@/lib/utils';
import { SPRING_PREMIUM } from '@/lib/animations';
import { HoverPeekOverlay } from '@/components/ui/HoverPeekOverlay';
import { useShellSidebarResize } from './useShellSidebarResize';
import { RESIZE_HANDLE_HALF_WIDTH } from './ResizeDividerVisual';
import { ResizeHandle } from './ResizeHandle';

interface UnifiedSidebarContainerProps {
  children: ReactNode;
  width: number;
  collapsed: boolean;
  onWidthChange: (width: number) => void;
  onPeekChange?: (isPeeking: boolean) => void;
  backgroundColor?: string;
  peekContent?: ReactNode;
}

export function UnifiedSidebarContainer({
  children,
  width,
  collapsed,
  onWidthChange,
  onPeekChange,
  backgroundColor = NOTES_COLORS.sidebarBg,
  peekContent
}: UnifiedSidebarContainerProps) {
  const { isDragging, handleDragStart } = useShellSidebarResize({
    width,
    onWidthChange
  });

  const [isPeeking, setIsPeeking] = useState(false);

  useEffect(() => {
    onPeekChange?.(isPeeking);
  }, [isPeeking, onPeekChange]);

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

      <HoverPeekOverlay
        isEnabled={collapsed}
        width={width}
        style={{ backgroundColor }}
        onPeekChange={setIsPeeking}
      >
        {peekContent || children}
      </HoverPeekOverlay>

      {!collapsed && (
        <>
          <div className="w-0.5 flex-shrink-0 z-20" style={{ backgroundColor }} />
          <ResizeHandle
            onMouseDown={handleDragStart}
            isDragging={isDragging}
            tooltipSide="right"
            shortcutKeys={['Ctrl', '\\']}
            positionStyle={{
              left: width - RESIZE_HANDLE_HALF_WIDTH,
              pointerEvents: collapsed ? 'none' : 'auto',
            }}
          />
        </>
      )}
    </>
  );
}
