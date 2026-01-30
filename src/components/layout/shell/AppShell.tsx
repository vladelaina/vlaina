import { ReactNode } from 'react';
import { cn, NOTES_COLORS } from '@/lib/utils';
import { UnifiedSidebarContainer } from './UnifiedSidebarContainer';
import { UnifiedTitleBar } from './UnifiedTitleBar';

interface AppShellProps {
  /** Main content area */
  children: ReactNode;
  
  /** Sidebar Configuration */
  sidebarContent?: ReactNode;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  onSidebarWidthChange: (width: number) => void;
  onSidebarToggle: () => void;
  onPeekChange?: (isPeeking: boolean) => void;
  /** Optional: content to show in sidebar when peeking (defaults to sidebarContent) */
  sidebarPeekContent?: ReactNode;
  
  /** TitleBar Configuration */
  titleBarLeft?: ReactNode;
  titleBarCenter?: ReactNode;
  titleBarRight?: ReactNode;
  
  /** Styles */
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
      "h-full flex overflow-hidden flex-col", // Changed to flex-col to stack TitleBar on top
      "bg-[var(--neko-bg-primary)]",
      isDragging && "select-none cursor-col-resize"
    )}>
      
      {/* 1. Unified TitleBar (Spans full width) */}
      <UnifiedTitleBar 
        leftSlot={titleBarLeft}
        centerSlot={titleBarCenter}
        rightSlot={titleBarRight}
        sidebarWidth={sidebarWidth}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={onSidebarToggle}
        backgroundColor={backgroundColor}
        // We can pass isPeeking if we track it in parent, 
        // but for now the expand button handles its own hover state mostly, 
        // or we can wire it up if needed.
      />
      
      {/* 2. Main Workspace (Sidebar + Content) */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        
        {/* Unified Sidebar */}
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
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-800 relative neko-scrollbar">
          {children}
        </main>
        
      </div>
    </div>
  );
}