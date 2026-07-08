import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiSlice';
import { themeDomStyleTokens } from '@/styles/themeTokens';
import { UnifiedSidebarContainer } from './UnifiedSidebarContainer';
import { UnifiedTitleBar } from './UnifiedTitleBar';

const TITLEBAR_SIDEBAR_PEEK_CLOSE_DELAY_MS = 140;

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
  const sidebarPeekCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const [isSidebarPeeking, setIsSidebarPeeking] = useState(false);
  const setLayoutPanelDragging = useUIStore((state) => state.setLayoutPanelDragging);

  const clearSidebarPeekCloseTimer = useCallback(() => {
    if (!sidebarPeekCloseTimerRef.current) return;
    clearTimeout(sidebarPeekCloseTimerRef.current);
    sidebarPeekCloseTimerRef.current = null;
  }, []);

  const openSidebarPeek = useCallback(() => {
    clearSidebarPeekCloseTimer();
    if (!sidebarCollapsed) return;
    setIsSidebarPeeking(true);
  }, [clearSidebarPeekCloseTimer, sidebarCollapsed]);

  const scheduleSidebarPeekClose = useCallback(() => {
    clearSidebarPeekCloseTimer();
    if (!sidebarCollapsed) return;

    sidebarPeekCloseTimerRef.current = setTimeout(() => {
      sidebarPeekCloseTimerRef.current = null;
      setIsSidebarPeeking(false);
    }, TITLEBAR_SIDEBAR_PEEK_CLOSE_DELAY_MS);
  }, [clearSidebarPeekCloseTimer, sidebarCollapsed]);

  const handleSidebarPeekChange = useCallback((peeking: boolean) => {
    clearSidebarPeekCloseTimer();
    setIsSidebarPeeking(peeking);
  }, [clearSidebarPeekCloseTimer]);

  const handleCollapsedSidebarToggleHoverChange = useCallback((hovered: boolean) => {
    if (hovered) {
      openSidebarPeek();
      return;
    }

    scheduleSidebarPeekClose();
  }, [openSidebarPeek, scheduleSidebarPeekClose]);

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
  }, [applySidebarWidth, sidebarCollapsed, sidebarWidth]);

  useLayoutEffect(() => {
    if (!sidebarCollapsed) {
      clearSidebarPeekCloseTimer();
      setIsSidebarPeeking(false);
    }
  }, [clearSidebarPeekCloseTimer, sidebarCollapsed]);

  useEffect(() => clearSidebarPeekCloseTimer, [clearSidebarPeekCloseTimer]);

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
        onCollapsedSidebarToggleHoverChange={handleCollapsedSidebarToggleHoverChange}
        backgroundColor={backgroundColor}
      />
      
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        
        {sidebarContent && sidebarCollapsed ? (
          <div
            data-shell-sidebar-peek-layer="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-[var(--vlaina-z-40)]"
          >
            <div
              data-shell-sidebar-peek-hotzone="true"
              className="pointer-events-auto absolute inset-y-0 left-0"
              style={{ width: themeDomStyleTokens.hoverPeekTriggerWidthPx }}
              aria-hidden="true"
              onMouseEnter={openSidebarPeek}
            />
          </div>
        ) : null}

        {sidebarContent ? (
          <UnifiedSidebarContainer
            width={sidebarWidth}
            collapsed={sidebarCollapsed}
            peeking={isSidebarPeeking}
            onPeekChange={handleSidebarPeekChange}
            onWidthChange={onSidebarWidthChange}
            onLiveWidthChange={applySidebarWidth}
            onDragStateChange={handleSidebarDragStateChange}
            widthScopeRef={sidebarWidthScopeRef}
            backgroundColor={backgroundColor}
          >
            {sidebarContent}
          </UnifiedSidebarContainer>
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
