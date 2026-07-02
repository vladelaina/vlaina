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
  const sidebarPeekWidthScopeRef = useRef<HTMLElement>(null);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const [isSidebarPeeking, setIsSidebarPeeking] = useState(false);
  const setLayoutPanelDragging = useUIStore((state) => state.setLayoutPanelDragging);

  const applySidebarWidth = useCallback((width: number) => {
    const sidebarWidthValue = `${width}px`;
    const sidebarContentInnerValue = `calc(${sidebarWidthValue} - var(--vlaina-size-32px))`;

    for (const target of [titleBarWidthScopeRef.current, sidebarWidthScopeRef.current, sidebarPeekWidthScopeRef.current]) {
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
  }, [applySidebarWidth, sidebarCollapsed, sidebarWidth]);

  useLayoutEffect(() => {
    if (!sidebarCollapsed) {
      setIsSidebarPeeking(false);
    }
  }, [sidebarCollapsed]);

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
        
        {sidebarContent && !sidebarCollapsed && (
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

        {sidebarContent && sidebarCollapsed ? (
          <div
            data-shell-sidebar-peek-layer="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-[var(--vlaina-z-40)]"
          >
            <div
              data-shell-sidebar-peek-hotzone="true"
              className="pointer-events-auto absolute inset-y-0 left-0 w-3"
              aria-hidden="true"
              onMouseEnter={() => setIsSidebarPeeking(true)}
            />
            <aside
              ref={sidebarPeekWidthScopeRef}
              data-shell-sidebar-peek="true"
              data-open={isSidebarPeeking ? 'true' : 'false'}
              aria-hidden={!isSidebarPeeking}
              className={cn(
                'absolute inset-y-0 left-0 flex min-h-0 flex-col overflow-hidden select-none transition-[opacity,transform] duration-[var(--vlaina-duration-200)] ease-out',
                isSidebarPeeking
                  ? 'translate-x-0 opacity-[var(--vlaina-opacity-100)] pointer-events-auto'
                  : '-translate-x-full opacity-[var(--vlaina-opacity-0)] pointer-events-none',
              )}
              style={{
                width: 'var(--vlaina-shell-sidebar-width)',
              }}
              onMouseEnter={() => setIsSidebarPeeking(true)}
              onMouseLeave={() => setIsSidebarPeeking(false)}
            >
              {sidebarContent}
            </aside>
          </div>
        ) : null}
        
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
