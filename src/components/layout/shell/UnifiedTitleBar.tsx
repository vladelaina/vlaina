import { ReactNode, useCallback } from 'react';
import { Icon } from '@/components/ui/icons';
import { WindowControls } from '@/components/layout/WindowControls';
import { blurComposerInput, isComposerInputFocused } from '@/lib/ui/composerFocusRegistry';

interface UnifiedTitleBarProps {
  leftSlot?: ReactNode;
  centerSlot?: ReactNode;
  rightSlot?: ReactNode;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  backgroundColor?: string;
  centerOverflowVisible?: boolean;
  showWindowControls?: boolean;
}

export function UnifiedTitleBar({
  leftSlot,
  centerSlot,
  rightSlot,
  sidebarCollapsed,
  onToggleSidebar,
  backgroundColor = 'var(--vlaina-color-surface-shell-sidebar)',
  centerOverflowVisible = false,
  showWindowControls = true
}: UnifiedTitleBarProps) {
  const handleTitleBarMouseDownCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    const target = e.target as Element | null;
    if (target?.closest('button, a, input, textarea, select, [role="button"], .vlaina-no-drag')) {
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
      className="vlaina-drag-region vlaina-title-bar h-10 dark:bg-zinc-900 flex items-center select-none relative z-50 flex-shrink-0"
      style={{ backgroundColor }}
      onMouseDownCapture={handleTitleBarMouseDownCapture}
    >
      {sidebarCollapsed ? (
        <div className="relative z-20 flex items-center h-full pl-2 pr-3 bg-[var(--vlaina-bg-primary)] dark:bg-zinc-800">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="vlaina-no-drag group flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[var(--chat-sidebar-text)] transition-colors hover:bg-[var(--vlaina-bg-primary)] hover:text-[var(--chat-sidebar-text)] dark:hover:bg-white/10"
          >
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-text-align-start-icon lucide-text-align-start size-5 group-hover:hidden"
              >
                <path d="M21 5H3" />
                <path d="M15 12H3" />
                <path d="M17 19H3" />
              </svg>
              <Icon name="nav.expand" size="titlebarToggle" className="hidden group-hover:block" />
            </>
          </button>
        </div>
      ) : (
        <div
          className="h-full flex-shrink-0 z-20 group flex flex-col justify-center vlaina-drag-region"
          style={{ width: 'var(--vlaina-shell-sidebar-width)' }}
        >
          {leftSlot}
        </div>
      )}

      <div
        className="absolute top-0 bottom-0 right-0 bg-[var(--vlaina-bg-primary)] dark:bg-zinc-800"
        style={{ left: sidebarCollapsed ? 0 : 'var(--vlaina-shell-sidebar-width)' }}
      />

      <div className={`vlaina-no-drag vlaina-title-bar-center flex-1 flex items-center z-20 min-w-0 h-full relative ${centerOverflowVisible ? 'overflow-visible' : 'overflow-hidden'}`}>
        {centerSlot}
      </div>

      {rightSlot && (
        <div className="relative z-20 flex items-center h-full bg-[var(--vlaina-bg-primary)] dark:bg-zinc-800 pr-2 vlaina-drag-region">
          {rightSlot}
        </div>
      )}

      {showWindowControls ? <WindowControls className="z-50" /> : null}
    </div>
  );
}
