import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Pin } from 'lucide-react';

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
        className="h-full w-12 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        title={isPinned ? 'Unpin window' : 'Pin window'}
      >
        <Pin className={`size-4 transition-all duration-200 ${isPinned ? 'text-zinc-500 rotate-0' : 'text-zinc-200 hover:text-zinc-400 dark:text-zinc-700 dark:hover:text-zinc-500 rotate-45'}`} />
      </button>

      <button
        onClick={() => appWindow.minimize()}
        className="h-full w-12 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <Minus className="size-4 text-zinc-200 hover:text-zinc-400 dark:text-zinc-700 dark:hover:text-zinc-500" />
      </button>

      <button
        onClick={() => appWindow.toggleMaximize()}
        className="h-full w-12 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <Square className="size-3.5 text-zinc-200 hover:text-zinc-400 dark:text-zinc-700 dark:hover:text-zinc-500" />
      </button>

      <button
        onClick={() => appWindow.close()}
        className="h-full w-12 flex items-center justify-center hover:bg-red-500 transition-colors group"
      >
        <X className="size-4 text-zinc-200 hover:text-zinc-400 group-hover:text-white dark:text-zinc-700 dark:hover:text-zinc-500" />
      </button>
    </div>
  );
}
