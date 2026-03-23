import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn, NOTES_COLORS } from '@/lib/utils';
import { useUIStore } from '@/stores/uiSlice';
import { UnifiedSidebarContainer } from './UnifiedSidebarContainer';
import { UnifiedTitleBar } from './UnifiedTitleBar';

interface AppShellProps {
  children: ReactNode;
  
  sidebarContent?: ReactNode;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  onSidebarWidthChange: (width: number) => void;
  onSidebarToggle: () => void;
  
  titleBarLeft?: ReactNode;
  titleBarCenter?: ReactNode;
  titleBarRight?: ReactNode;
  mainOverlay?: ReactNode;
  
  backgroundColor?: string;
  isDragging?: boolean;
}

export function AppShell({
  children,
  
  sidebarContent,
  sidebarWidth,
  sidebarCollapsed,
  onSidebarWidthChange,
  onSidebarToggle,
  
  titleBarLeft,
  titleBarCenter,
  titleBarRight,
  mainOverlay,
  
  backgroundColor = NOTES_COLORS.sidebarBg,
  isDragging = false
}: AppShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const setLayoutPanelDragging = useUIStore((state) => state.setLayoutPanelDragging);
  const setWindowResizeActive = useUIStore((state) => state.setWindowResizeActive);

  const applySidebarWidth = useCallback((width: number) => {
    shellRef.current?.style.setProperty('--neko-shell-sidebar-width', `${width}px`);
  }, []);

  const handleSidebarDragStateChange = useCallback((dragging: boolean) => {
    setIsSidebarDragging(dragging);
    setLayoutPanelDragging(dragging);
  }, [setLayoutPanelDragging]);

  useLayoutEffect(() => {
    applySidebarWidth(sidebarWidth);
  }, [applySidebarWidth, sidebarWidth]);

  useEffect(() => {
    let settleTimer: number | null = null;
    let hasActiveResize = false;

    const handleResize = () => {
      if (!hasActiveResize) {
        hasActiveResize = true;
        setWindowResizeActive(true);
      }

      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }

      settleTimer = window.setTimeout(() => {
        hasActiveResize = false;
        setWindowResizeActive(false);
        settleTimer = null;
      }, 180);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
      setWindowResizeActive(false);
    };
  }, [setWindowResizeActive]);

  return (
    <div
      ref={shellRef}
      className={cn(
        "h-full flex overflow-hidden flex-col",
        "bg-[var(--neko-bg-primary)]",
        (isDragging || isSidebarDragging) && "select-none cursor-col-resize"
      )}
    >
      
      <UnifiedTitleBar 
        leftSlot={titleBarLeft}
        centerSlot={titleBarCenter}
        rightSlot={titleBarRight}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={onSidebarToggle}
        backgroundColor={backgroundColor}
      />
      
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        
        {sidebarContent && (
          <UnifiedSidebarContainer
            width={sidebarWidth}
            collapsed={sidebarCollapsed}
            onWidthChange={onSidebarWidthChange}
            onLiveWidthChange={applySidebarWidth}
            onDragStateChange={handleSidebarDragStateChange}
            backgroundColor={backgroundColor}
          >
            {sidebarContent}
          </UnifiedSidebarContainer>
        )}
        
        <main
          className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-800 relative neko-scrollbar"
        >
          {children}
          {mainOverlay}
        </main>
        
      </div>
    </div>
  );
}
