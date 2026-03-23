import { ReactNode, useCallback } from 'react';
import { Icon } from '@/components/ui/icons';
import { NOTES_COLORS } from '@/lib/utils';
import { WindowControls } from '@/components/layout/WindowControls';
import { blurComposerInput, isComposerInputFocused } from '@/lib/ui/composerFocusRegistry';

interface UnifiedTitleBarProps {
  leftSlot?: ReactNode;
  centerSlot?: ReactNode;
  rightSlot?: ReactNode;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  backgroundColor?: string;
  showWindowControls?: boolean;
}

export function UnifiedTitleBar({
  leftSlot,
  centerSlot,
  rightSlot,
  sidebarCollapsed,
  onToggleSidebar,
  backgroundColor = NOTES_COLORS.sidebarBg,
  showWindowControls = true
}: UnifiedTitleBarProps) {
  const handleTitleBarMouseDownCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    const target = e.target as Element | null;
    if (target?.closest('button, a, input, textarea, select, [role="button"]')) {
      return;
    }

    if (!isComposerInputFocused()) {
      return;
    }

    requestAnimationFrame(() => {
      blurComposerInput();
    });
  }, []);

  return (
    <div
      className="h-10 dark:bg-zinc-900 flex items-center select-none relative z-50 flex-shrink-0"
      style={{ backgroundColor }}
      data-tauri-drag-region
      onMouseDownCapture={handleTitleBarMouseDownCapture}
    >
      {sidebarCollapsed ? (
        <div className="relative z-20 flex h-full items-center pl-2">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Expand sidebar"
            className="group flex h-8 w-8 items-center justify-center rounded-md text-[var(--neko-text-tertiary)] transition-colors hover:bg-[#f5f5f5] hover:text-[var(--neko-text-primary)] dark:hover:bg-white/10"
          >
            <>
              <Icon name="common.menu" size="md" className="group-hover:hidden" />
              <Icon name="nav.expand" size="md" className="hidden group-hover:block" />
            </>
          </button>
        </div>
      ) : (
        <div
          className="h-full flex-shrink-0 z-20 group flex flex-col justify-center"
          style={{ width: 'var(--neko-shell-sidebar-width)' }}
          data-tauri-drag-region
        >
          {leftSlot}
        </div>
      )}

      {!sidebarCollapsed ? (
        <div
          className="absolute top-0 bottom-0 z-30 w-px"
          style={{ left: 'var(--neko-shell-sidebar-width)', backgroundColor: NOTES_COLORS.divider }}
        />
      ) : null}

      <div
        className="absolute top-0 bottom-0 right-0 bg-white dark:bg-zinc-800"
        style={{ left: sidebarCollapsed ? 0 : 'var(--neko-shell-sidebar-width)' }}
      />

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
