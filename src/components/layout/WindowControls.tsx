import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { IconMinus, IconSquare, IconX, IconPin } from '@tabler/icons-react';
import { iconButtonStyles } from '@/lib/utils';

const appWindow = getCurrentWindow();

interface WindowControlsProps {
  className?: string;
}

export function WindowControls({ className }: WindowControlsProps) {
  const [isPinned, setIsPinned] = useState(false);

  const togglePin = async () => {
    const newPinned = !isPinned;
    await appWindow.setAlwaysOnTop(newPinned);
    setIsPinned(newPinned);
  };

  return (
    <div className={`flex shrink-0 h-10 ${className || ''}`}>
      <button
        onClick={togglePin}
        className={`h-full w-12 flex items-center justify-center transition-colors ${iconButtonStyles}`}
      >
        <IconPin className={`size-4 transition-all duration-200 ${isPinned ? 'rotate-0' : 'rotate-45'}`} />
      </button>

      <button
        onClick={() => appWindow.minimize()}
        className={`h-full w-12 flex items-center justify-center transition-colors ${iconButtonStyles}`}
      >
        <IconMinus className="size-4" />
      </button>

      <button
        onClick={() => appWindow.toggleMaximize()}
        className={`h-full w-12 flex items-center justify-center transition-colors ${iconButtonStyles}`}
      >
        <IconSquare className="size-3.5" />
      </button>

      <button
        onClick={() => appWindow.close()}
        className="h-full w-12 flex items-center justify-center hover:bg-red-500 transition-colors group"
      >
        <IconX className="size-4 text-[var(--neko-text-tertiary)] group-hover:text-white" />
      </button>
    </div>
  );
}
