import { ReactNode, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn, NOTES_COLORS } from '@/lib/utils';
import { SPRING_PREMIUM } from '@/lib/animations';
import { HoverPeekOverlay } from '@/components/ui/HoverPeekOverlay';
import { useShellSidebarResize } from './useShellSidebarResize';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

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
          
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <div
                onMouseDown={handleDragStart}
                className={cn(
                  "w-3 cursor-col-resize group", // Increased width slightly for easier hover
                  "fixed top-0 bottom-0 z-30",
                  "flex items-center justify-center"
                )}
                style={{ 
                  left: width - 2,
                  pointerEvents: collapsed ? 'none' : 'auto'
                }}
              >
                <div
                  className="w-0.5 h-full transition-colors opacity-0 group-hover:opacity-100"
                  style={{
                    backgroundColor: isDragging ? NOTES_COLORS.dividerHover : undefined,
                  }}
                  // Fallback for non-dragging hover handled by group-hover class above for smoother CSS transition
                >
                   <div className="w-full h-full bg-zinc-300 dark:bg-zinc-700/50" />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={5} className="flex items-center gap-1.5 text-xs">
              <span>Toggle Sidebar</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-700 text-zinc-100 font-sans">Ctrl</kbd>
              <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-700 text-zinc-100 font-sans">\</kbd>
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </>
  );
}