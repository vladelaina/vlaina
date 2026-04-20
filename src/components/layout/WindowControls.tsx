import { desktopWindow } from '@/lib/desktop/window';
import { Icon } from '@/components/ui/icons';
import { iconButtonStyles } from '@/lib/utils';

interface WindowControlsProps {
  className?: string;
  minimal?: boolean;
}

export function WindowControls({ className, minimal }: WindowControlsProps) {
  return (
    <div className={`vlaina-no-drag flex shrink-0 h-10 ${className || ''}`}>
      <button
        onClick={() => void desktopWindow.minimize()}
        className={`h-full w-12 flex items-center justify-center transition-colors ${iconButtonStyles}`}
      >
        <Icon size="md" name="window.minimize" />
      </button>

      {!minimal && (
        <button
          onClick={() => void desktopWindow.toggleMaximize()}
          className={`h-full w-12 flex items-center justify-center transition-colors ${iconButtonStyles}`}
        >
          <Icon name="window.maximize" size="md" />
        </button>
      )}

      <button
        onClick={() => void desktopWindow.close()}
        className="h-full w-12 flex items-center justify-center hover:bg-red-500 transition-colors group"
      >
        <Icon size="md" name="window.close" className="text-[var(--vlaina-text-tertiary)] group-hover:text-white" />
      </button>
    </div>
  );
}
