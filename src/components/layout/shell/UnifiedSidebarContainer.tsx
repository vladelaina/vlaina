import { ReactNode, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn, NOTES_COLORS } from '@/lib/utils';
import { SPRING_PREMIUM } from '@/lib/animations';
import { HoverPeekOverlay } from '@/components/ui/HoverPeekOverlay';
import { useShellSidebarResize } from './useShellSidebarResize';

interface UnifiedSidebarContainerProps {
  /** The content to display inside the sidebar */
  children: ReactNode;
  /** Current width of the sidebar */
  width: number;
  /** Whether the sidebar is collapsed */
  collapsed: boolean;
  /** Callback to change width */
  onWidthChange: (width: number) => void;
  /** Callback to report peeking state (for titlebar coordination) */
  onPeekChange?: (isPeeking: boolean) => void;
  /** Custom background color (optional, defaults to NOTES_COLORS.sidebarBg) */
  backgroundColor?: string;
  /** Props to pass to the peeking overlay version of the content */
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
  const [isHoveringHeader, setIsHoveringHeader] = useState(false);

  // Sync peeking state to parent
  useEffect(() => {
    onPeekChange?.(isPeeking);
  }, [isPeeking, onPeekChange]);

  return (
    <>
      {/* Static Sidebar with Premium Physics */}
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
        {/* Pass isPeeking=false to content */}
        {children}
      </motion.aside>

      {/* Hover Peek - Trigger Zone & Floating Sidebar */}
      <HoverPeekOverlay
        isEnabled={collapsed}
        width={width}
        style={{ backgroundColor }}
        onPeekChange={setIsPeeking}
      >
        {/* Use explicit peekContent if provided, otherwise fallback to children */}
        {peekContent || children}
      </HoverPeekOverlay>

      {/* Resize Handle */}
      {!collapsed && (
        <>
          {/* Visual divider line */}
          <div className="w-0.5 flex-shrink-0 z-20" style={{ backgroundColor }} />
          
          {/* Interactive resize handle */}
          <div
            onMouseDown={handleDragStart}
            onMouseEnter={() => setIsHoveringHeader(true)}
            onMouseLeave={() => setIsHoveringHeader(false)}
            className={cn(
              "w-2 cursor-col-resize group",
              "fixed top-0 bottom-0 z-30", // Higher z-index to sit above content
              "flex items-center justify-center"
            )}
            style={{ 
              left: width - 2,
              // Disable pointer events when collapsed to avoid ghost clicks
              pointerEvents: collapsed ? 'none' : 'auto'
            }}
          >
            <div
              className="w-0.5 h-full transition-colors"
              style={{
                backgroundColor: isDragging ? NOTES_COLORS.dividerHover : 'transparent',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = NOTES_COLORS.dividerHover}
              onMouseLeave={(e) => !isDragging && (e.currentTarget.style.backgroundColor = 'transparent')}
            />
          </div>
        </>
      )}
    </>
  );
}
