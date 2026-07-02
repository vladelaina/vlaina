import { desktopWindow } from '@/lib/desktop/window';
import { Icon } from '@/components/ui/icons';
import { isMacOS, isNativeWindows } from '@/lib/desktop/platform';
import { isElectronRuntime } from '@/lib/electron/bridge';
import { useUIStore } from '@/stores/uiSlice';

interface WindowControlsProps {
  className?: string;
  minimal?: boolean;
}

export function WindowControls({ className, minimal }: WindowControlsProps) {
  const devPlatformPreview = useUIStore((state) => state.devPlatformPreview);

  if (isMacOS(devPlatformPreview)) {
    return null;
  }

  if (isElectronRuntime() && isNativeWindows()) {
    return (
      <div
        aria-hidden="true"
        data-window-controls="true"
        className={`app-no-drag h-10 w-[var(--vlaina-width-window-controls)] shrink-0 ${className || ''}`}
      />
    );
  }

  const sidebarTextButtonClass =
    'cursor-pointer bg-transparent text-[var(--vlaina-sidebar-chat-text)] hover:text-[var(--vlaina-sidebar-chat-text)] disabled:cursor-default';

  return (
    <div data-window-controls="true" className={`app-no-drag flex shrink-0 h-10 ${className || ''}`}>
      <button
        data-window-control="minimize"
        onClick={() => void desktopWindow.minimize()}
        className={`h-full w-12 flex items-center justify-center transition-colors ${sidebarTextButtonClass}`}
      >
        <Icon size="md" name="window.minimize" />
      </button>

      {!minimal && (
        <button
          data-window-control="maximize"
          onClick={() => void desktopWindow.toggleMaximize()}
          className={`h-full w-12 flex items-center justify-center transition-colors ${sidebarTextButtonClass}`}
        >
          <Icon name="window.maximize" size="md" />
        </button>
      )}

      <button
        data-window-control="close"
        onClick={() => void desktopWindow.close()}
        className={`h-full w-12 flex items-center justify-center hover:bg-[var(--vlaina-color-danger)] transition-colors group ${sidebarTextButtonClass}`}
      >
        <Icon size="md" name="window.close" className="group-hover:text-[var(--vlaina-color-white)]" />
      </button>
    </div>
  );
}
