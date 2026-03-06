import { ReactNode } from 'react';
import { cn, NOTES_COLORS } from '@/lib/utils';
import { UnifiedSidebarContainer } from './UnifiedSidebarContainer';
import { UnifiedTitleBar } from './UnifiedTitleBar';

interface AppShellProps {
  children: ReactNode;
  
  sidebarContent?: ReactNode;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  onSidebarWidthChange: (width: number) => void;
  onSidebarToggle: () => void;
  onPeekChange?: (isPeeking: boolean) => void;
  sidebarPeekContent?: ReactNode;
  
  titleBarLeft?: ReactNode;
  titleBarCenter?: ReactNode;
  titleBarRight?: ReactNode;
  
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
  onPeekChange,
  sidebarPeekContent,
  
  titleBarLeft,
  titleBarCenter,
  titleBarRight,
  
  backgroundColor = NOTES_COLORS.sidebarBg,
  isDragging = false
}: AppShellProps) {
  
  return (
    <div className={cn(
      "h-full flex overflow-hidden flex-col",
      "bg-[var(--neko-bg-primary)]",
      isDragging && "select-none cursor-col-resize"
    )}>
      
      <UnifiedTitleBar 
        leftSlot={titleBarLeft}
        centerSlot={titleBarCenter}
        rightSlot={titleBarRight}
        sidebarWidth={sidebarWidth}
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
            onPeekChange={onPeekChange}
            backgroundColor={backgroundColor}
            peekContent={sidebarPeekContent}
          >
            {sidebarContent}
          </UnifiedSidebarContainer>
        )}
        
        <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-800 relative neko-scrollbar">
          {children}
        </main>
        
      </div>
    </div>
  );
}
