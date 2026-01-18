import { ReactNode } from 'react';
import { cn, NOTES_COLORS } from '@/lib/utils';
import { WindowControls } from '@/components/layout/WindowControls';
import { SidebarExpandButton } from '@/components/layout/SidebarExpandButton';

interface UnifiedTitleBarProps {
  /** Content for the left slot (User Menu) - matches sidebar width */
  leftSlot?: ReactNode;
  /** Content for the center slot (Tabs, DatePicker, etc.) */
  centerSlot?: ReactNode;
  /** Content for the right slot (Toolbar actions) */
  rightSlot?: ReactNode;
  
  /** Sidebar state for layout calculations */
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  isPeeking?: boolean;
  onToggleSidebar?: () => void;
  
  /** Background color override */
  backgroundColor?: string;
  /** Whether to show window controls (close/min/max) */
  showWindowControls?: boolean;
}

const RESIZE_HANDLE_WIDTH = 4;

export function UnifiedTitleBar({
  leftSlot,
  centerSlot,
  rightSlot,
  sidebarWidth,
  sidebarCollapsed,
  isPeeking = false,
  onToggleSidebar,
  backgroundColor = NOTES_COLORS.sidebarBg,
  showWindowControls = true
}: UnifiedTitleBarProps) {
  
  return (
    <div
      className="h-10 dark:bg-zinc-900 flex items-center select-none relative z-50 flex-shrink-0"
      style={{ backgroundColor }}
      data-tauri-drag-region
    >
      {/* --- Left Slot (Sidebar Header) --- */}
      <div
        className={cn(
          "h-full flex-shrink-0 z-20 group flex flex-col justify-center",
          sidebarCollapsed ? "hidden" : "flex"
        )}
        style={{ width: sidebarWidth }}
        data-tauri-drag-region
      >
        {leftSlot}
      </div>

      {/* --- Expand Button (When Collapsed) --- */}
      {sidebarCollapsed && onToggleSidebar && (
        <SidebarExpandButton
          onClick={onToggleSidebar}
          isPeeking={isPeeking}
        />
      )}

      {/* --- Visual Spacer/Divider --- */}
      {/* When expanded, this creates space for the resize handle */}
      {!sidebarCollapsed && (
        <div className="w-1 h-full flex-shrink-0" />
      )}

      {/* --- Main Content Area Background (Cutout Effect) --- */}
      {/* This white/dark background sits behind the center slot */}
      {!sidebarCollapsed && (
        <div
          className="absolute top-0 bottom-0 right-0 bg-white dark:bg-zinc-800"
          style={{
            left: sidebarWidth + RESIZE_HANDLE_WIDTH,
          }}
        />
      )}
      
      {/* Full width background when collapsed */}
      {sidebarCollapsed && (
        <div
          className="absolute top-0 bottom-0 left-0 right-0 bg-white dark:bg-zinc-800"
        />
      )}

      {/* --- Center Slot (Tabs / Toolbar) --- */}
      <div className="flex-1 flex items-center z-20 overflow-hidden min-w-0 h-full relative" data-tauri-drag-region>
        {centerSlot}
      </div>

      {/* --- Right Slot (Actions) --- */}
      {rightSlot && (
        <div className="relative z-20 flex items-center h-full bg-white dark:bg-zinc-800 pr-2" data-tauri-drag-region>
          {rightSlot}
        </div>
      )}

      {/* --- Window Controls --- */}
      {showWindowControls && (
        <WindowControls className="z-50" />
      )}
    </div>
  );
}
