import { desktopWindow } from '@/lib/desktop/window';
import { Icon } from '@/components/ui/icons';
import { isMacOS } from '@/lib/desktop/platform';

interface WindowControlsProps {
  className?: string;
  minimal?: boolean;
}

export function WindowControls({ className, minimal }: WindowControlsProps) {
  if (isMacOS()) {
    return null;
  }

  const sidebarTextButtonClass =
    'cursor-pointer bg-transparent text-[var(--chat-sidebar-text)] hover:text-[var(--chat-sidebar-text)] disabled:cursor-default';

  return (
    <div className={`vlaina-no-drag flex shrink-0 h-10 ${className || ''}`}>
      <button
        onClick={() => void desktopWindow.minimize()}
        className={`h-full w-12 flex items-center justify-center transition-colors ${sidebarTextButtonClass}`}
      >
        <Icon size="md" name="window.minimize" />
      </button>

      {!minimal && (
        <button
          onClick={() => void desktopWindow.toggleMaximize()}
          className={`h-full w-12 flex items-center justify-center transition-colors ${sidebarTextButtonClass}`}
        >
          <Icon name="window.maximize" size="md" />
        </button>
      )}

      <button
        onClick={() => void desktopWindow.close()}
        className={`h-full w-12 flex items-center justify-center hover:bg-[var(--vlaina-color-danger)] transition-colors group ${sidebarTextButtonClass}`}
      >
        <Icon size="md" name="window.close" className="group-hover:text-[var(--vlaina-color-white)]" />
      </button>
    </div>
  );
}
