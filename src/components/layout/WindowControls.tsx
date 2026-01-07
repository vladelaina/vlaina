import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { IconMinus, IconSquare, IconX, IconPin } from '@tabler/icons-react';
import { iconButtonStyles } from '@/lib/utils';

interface WindowControlsProps {
  className?: string;
  /** When true, only show minimize and close buttons */
  minimal?: boolean;
}

export function WindowControls({ className, minimal }: WindowControlsProps) {
  const [isPinned, setIsPinned] = useState(false);

  // Get current window dynamically for each action (supports multiple windows)
  const getWindow = () => getCurrentWindow();

  const togglePin = async () => {
    const newPinned = !isPinned;
    await getWindow().setAlwaysOnTop(newPinned);
    setIsPinned(newPinned);
  };

  return (
    <div className={`flex shrink-0 h-10 ${className || ''}`}>
      {!minimal && (
        <button
          onClick={togglePin}
          className={`h-full w-12 flex items-center justify-center transition-colors ${iconButtonStyles}`}
        >
          <IconPin className={`size-4 transition-all duration-200 ${isPinned ? 'rotate-0' : 'rotate-45'}`} />
        </button>
      )}

      <button
        onClick={() => getWindow().minimize()}
        className={`h-full w-12 flex items-center justify-center transition-colors ${iconButtonStyles}`}
      >
        <IconMinus className="size-4" />
      </button>

      {!minimal && (
        <button
          onClick={() => getWindow().toggleMaximize()}
          className={`h-full w-12 flex items-center justify-center transition-colors ${iconButtonStyles}`}
        >
          <IconSquare className="size-3.5" />
        </button>
      )}

      <button
        onClick={() => getWindow().close()}
        className="h-full w-12 flex items-center justify-center hover:bg-red-500 transition-colors group"
      >
        <IconX className="size-4 text-[var(--neko-text-tertiary)] group-hover:text-white" />
      </button>
    </div>
  );
}
