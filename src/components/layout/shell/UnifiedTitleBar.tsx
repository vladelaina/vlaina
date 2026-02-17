import { ReactNode, useCallback } from 'react';
import { cn, NOTES_COLORS } from '@/lib/utils';
import { WindowControls } from '@/components/layout/WindowControls';
import { SidebarExpandButton } from '@/components/layout/SidebarExpandButton';
import { blurComposerInput, isComposerInputFocused } from '@/lib/ui/composerFocusRegistry';
import { logFocusTrace } from '@/lib/debug/focusTrace';

interface UnifiedTitleBarProps {
  leftSlot?: ReactNode;
  centerSlot?: ReactNode;
  rightSlot?: ReactNode;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  isPeeking?: boolean;
  onToggleSidebar?: () => void;
  backgroundColor?: string;
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
  const handleTitleBarMouseDownCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    logFocusTrace('titlebar.mousedown.capture', {
      button: e.button,
      targetTag: (e.target as Element | null)?.tagName ?? null
    });

    if (e.button !== 0) return;

    const target = e.target as Element | null;
    if (target?.closest('button, a, input, textarea, select, [role="button"]')) {
      logFocusTrace('titlebar.mousedown.skip.interactive');
      return;
    }

    if (!isComposerInputFocused()) {
      logFocusTrace('titlebar.mousedown.skip.composerNotFocused');
      return;
    }

    requestAnimationFrame(() => {
      const result = blurComposerInput();
      logFocusTrace('titlebar.blur.request', { result });
    });
  }, []);

  return (
    <div
      className="h-10 dark:bg-zinc-900 flex items-center select-none relative z-50 flex-shrink-0"
      style={{ backgroundColor }}
      data-tauri-drag-region
      onMouseDownCapture={handleTitleBarMouseDownCapture}
    >
      <div
        className={cn(
          'h-full flex-shrink-0 z-20 group flex flex-col justify-center',
          sidebarCollapsed ? 'hidden' : 'flex'
        )}
        style={{ width: sidebarWidth }}
        data-tauri-drag-region
      >
        {leftSlot}
      </div>

      {sidebarCollapsed && onToggleSidebar && (
        <SidebarExpandButton onClick={onToggleSidebar} isPeeking={isPeeking} />
      )}

      {!sidebarCollapsed && <div className="w-1 h-full flex-shrink-0" />}

      {!sidebarCollapsed && (
        <div
          className="absolute top-0 bottom-0 right-0 bg-white dark:bg-zinc-800"
          style={{ left: sidebarWidth + RESIZE_HANDLE_WIDTH }}
        />
      )}

      {sidebarCollapsed && (
        <div className="absolute top-0 bottom-0 left-0 right-0 bg-white dark:bg-zinc-800" />
      )}

      <div className="flex-1 flex items-center z-20 overflow-hidden min-w-0 h-full relative" data-tauri-drag-region>
        {centerSlot}
      </div>

      {rightSlot && (
        <div className="relative z-20 flex items-center h-full bg-white dark:bg-zinc-800 pr-2" data-tauri-drag-region>
          {rightSlot}
        </div>
      )}

      {showWindowControls && <WindowControls className="z-50" />}
    </div>
  );
}
