import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
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
  titleBarCenterOverflowVisible?: boolean;
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
  titleBarCenterOverflowVisible = false,
  mainOverlay,
  
  backgroundColor = 'transparent',
  isDragging = false
}: AppShellProps) {
  const titleBarWidthScopeRef = useRef<HTMLDivElement>(null);
  const sidebarWidthScopeRef = useRef<HTMLDivElement>(null);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const setLayoutPanelDragging = useUIStore((state) => state.setLayoutPanelDragging);

  const applySidebarWidth = useCallback((width: number) => {
    const sidebarWidthValue = `${width}px`;
    const sidebarContentInnerValue = `calc(${sidebarWidthValue} - var(--vlaina-size-32px))`;

    for (const target of [titleBarWidthScopeRef.current, sidebarWidthScopeRef.current]) {
      if (!target) continue;
      target.style.setProperty('--vlaina-shell-sidebar-width', sidebarWidthValue);
      target.style.setProperty('--vlaina-width-sidebar-content-inner', sidebarContentInnerValue);
    }
  }, []);

  const handleSidebarDragStateChange = useCallback((dragging: boolean) => {
    setIsSidebarDragging(dragging);
    setLayoutPanelDragging(dragging);
  }, [setLayoutPanelDragging]);

  useLayoutEffect(() => {
    applySidebarWidth(sidebarWidth);
  }, [applySidebarWidth, sidebarWidth]);

  return (
    <div
      data-app-shell-root="true"
      className={cn(
        "h-full flex overflow-hidden flex-col",
        (isDragging || isSidebarDragging) && "select-none cursor-col-resize"
      )}
    >
      
      <UnifiedTitleBar
        ref={titleBarWidthScopeRef}
        leftSlot={titleBarLeft}
        centerSlot={titleBarCenter}
        rightSlot={titleBarRight}
        centerOverflowVisible={titleBarCenterOverflowVisible}
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
            widthScopeRef={sidebarWidthScopeRef}
            backgroundColor={backgroundColor}
          >
            {sidebarContent}
          </UnifiedSidebarContainer>
        )}
        
        <main
          className="flex-1 flex flex-col min-w-0 relative app-scrollbar"
        >
          {children}
          {mainOverlay}
        </main>
        
      </div>
    </div>
  );
}
