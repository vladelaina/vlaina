import { getCurrentWindow } from '@tauri-apps/api/window';
import { Icon } from '@/components/ui/icons';
import { iconButtonStyles } from '@/lib/utils';

interface WindowControlsProps {
  className?: string;
  minimal?: boolean;
}

export function WindowControls({ className, minimal }: WindowControlsProps) {
  const getWindow = () => getCurrentWindow();

  return (
    <div className={`flex shrink-0 h-10 ${className || ''}`}>
      <button
        onClick={() => getWindow().minimize()}
        className={`h-full w-12 flex items-center justify-center transition-colors ${iconButtonStyles}`}
      >
        <Icon size="md" name="window.minimize" />
      </button>

      {!minimal && (
        <button
          onClick={() => getWindow().toggleMaximize()}
          className={`h-full w-12 flex items-center justify-center transition-colors ${iconButtonStyles}`}
        >
          <Icon name="window.maximize" size="sm" />
        </button>
      )}

      <button
        onClick={() => getWindow().close()}
        className="h-full w-12 flex items-center justify-center hover:bg-red-500 transition-colors group"
      >
        <Icon size="md" name="window.close" className="text-[var(--neko-text-tertiary)] group-hover:text-white" />
      </button>
    </div>
  );
}