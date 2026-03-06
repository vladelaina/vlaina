import { ReactNode, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NOTES_COLORS } from '@/lib/utils';
import { SPRING_PREMIUM } from '@/lib/animations';
import { HoverPeekOverlay } from '@/components/ui/HoverPeekOverlay';
import { useShellSidebarResize } from './useShellSidebarResize';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';

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
  const { handleDragStart } = useShellSidebarResize({
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
          <div className="w-px flex-shrink-0 z-20 bg-[var(--neko-border)]" />
          
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <div
                onMouseDown={handleDragStart}
                className="w-3 cursor-col-resize fixed top-0 bottom-0 z-30"
                style={{ 
                  left: width - 2,
                  pointerEvents: collapsed ? 'none' : 'auto'
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={5} className="flex items-center gap-1.5 text-xs">
              <span>Toggle Sidebar</span>
              <ShortcutKeys keys={['Ctrl', '\\']} />
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </>
  );
}
