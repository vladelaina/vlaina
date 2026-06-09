import { ReactNode, useCallback } from 'react';
import { Icon } from '@/components/ui/icons';
import { WindowControls } from '@/components/layout/WindowControls';
import { chatComposerGhostIconButtonClass } from '@/components/Chat/features/Input/composerStyles';
import { blurComposerInput, isComposerInputFocused } from '@/lib/ui/composerFocusRegistry';
import { isMacOS } from '@/lib/desktop/platform';
import { cn } from '@/lib/utils';
import { themeDomStyleTokens, themeIconTokens, themeStyleResetTokens } from '@/styles/themeTokens';

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
  backgroundColor = 'transparent',
  centerOverflowVisible = false,
  showWindowControls = true
}: UnifiedTitleBarProps) {
  const shouldReserveMacTrafficLightSpace = isMacOS();
  const handleTitleBarMouseDownCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    const target = e.target as Element | null;
    if (target?.closest('button, a, input, textarea, select, [role="button"], .app-no-drag')) {
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
      className="app-drag-region app-title-bar h-10 flex items-center select-none relative z-[var(--vlaina-z-50)] flex-shrink-0"
      style={{ backgroundColor }}
      onMouseDownCapture={handleTitleBarMouseDownCapture}
    >
      {sidebarCollapsed ? (
        <div className={`relative z-[var(--vlaina-z-20)] flex items-center h-full pr-3 bg-transparent ${shouldReserveMacTrafficLightSpace ? 'pl-[var(--vlaina-space-76px)]' : 'pl-2'}`}>
          <button
            type="button"
            onClick={onToggleSidebar}
            className={cn(
              "app-no-drag group flex h-8 w-8 cursor-pointer items-center justify-center text-[var(--vlaina-sidebar-chat-text)]",
              chatComposerGhostIconButtonClass
            )}
          >
            <>
              {/* Sidebar glyph adapted from Lucide Icons (ISC). */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill={themeStyleResetTokens.fillNone}
                viewBox={themeIconTokens.viewBoxDefault}
                stroke={themeStyleResetTokens.currentColor}
                strokeWidth={themeIconTokens.strokeDefault}
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
          className="h-full flex-shrink-0 z-[var(--vlaina-z-20)] group flex flex-col justify-center app-drag-region"
          style={{ width: themeDomStyleTokens.shellSidebarWidth }}
        >
          {leftSlot}
        </div>
      )}

      <div
        className="absolute top-0 bottom-0 right-0 bg-transparent"
        style={{ left: sidebarCollapsed ? 0 : themeDomStyleTokens.shellSidebarWidth }}
      />

      <div className={`app-drag-region app-title-bar-center flex-1 flex items-center z-[var(--vlaina-z-20)] min-w-0 h-full relative ${centerOverflowVisible ? 'overflow-visible' : 'overflow-hidden'}`}>
        {centerSlot}
      </div>

      {rightSlot && (
        <div className="relative z-[var(--vlaina-z-20)] flex items-center h-full bg-transparent pr-2 app-drag-region">
          {rightSlot}
        </div>
      )}

      {showWindowControls ? <WindowControls className="z-[var(--vlaina-z-50)]" /> : null}
    </div>
  );
}
