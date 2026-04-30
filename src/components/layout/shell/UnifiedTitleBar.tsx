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
  showWindowControls?: boolean;
}

export function UnifiedTitleBar({
  leftSlot,
  centerSlot,
  rightSlot,
  sidebarCollapsed,
  onToggleSidebar,
  backgroundColor = 'var(--vlaina-color-surface-shell-sidebar)',
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
      className="vlaina-drag-region h-10 dark:bg-zinc-900 flex items-center select-none relative z-50 flex-shrink-0"
      style={{ backgroundColor }}
      onMouseDownCapture={handleTitleBarMouseDownCapture}
    >
      {sidebarCollapsed ? (
        <div className="relative z-20 flex items-center h-full pl-2 pr-3 bg-[var(--vlaina-bg-primary)] dark:bg-zinc-800">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="vlaina-no-drag group flex h-8 w-8 items-center justify-center rounded-md text-[var(--vlaina-text-tertiary)] transition-colors hover:bg-[var(--vlaina-bg-primary)] hover:text-[var(--vlaina-text-primary)] dark:hover:bg-white/10"
          >
            <>
              <Icon name="common.menu" size="md" className="group-hover:hidden" />
              <Icon name="nav.expand" size="md" className="hidden group-hover:block" />
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

      {!sidebarCollapsed ? (
        <div
          className="absolute top-0 bottom-0 z-30 w-px"
          style={{ left: 'var(--vlaina-shell-sidebar-width)', backgroundColor: 'var(--vlaina-shell-divider)' }}
        />
      ) : null}

      <div
        className="absolute top-0 bottom-0 right-0 bg-[var(--vlaina-bg-primary)] dark:bg-zinc-800"
        style={{ left: sidebarCollapsed ? 0 : 'var(--vlaina-shell-sidebar-width)' }}
      />

      <div className="flex-1 flex items-center z-20 overflow-hidden min-w-0 h-full relative vlaina-drag-region">
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
