import { getCurrentWindow } from '@tauri-apps/api/window';
import { MdRemove, MdCheckBoxOutlineBlank, MdClose } from 'react-icons/md';
import { iconButtonStyles } from '@/lib/utils';

interface WindowControlsProps {
  className?: string;
  /** When true, only show minimize and close buttons */
  minimal?: boolean;
}

export function WindowControls({ className, minimal }: WindowControlsProps) {
  // Get current window dynamically for each action (supports multiple windows)
  const getWindow = () => getCurrentWindow();

  return (
    <div className={`flex shrink-0 h-10 ${className || ''}`}>
      <button
        onClick={() => getWindow().minimize()}
        className={`h-full w-12 flex items-center justify-center transition-colors ${iconButtonStyles}`}
      >
        <MdRemove className="size-[18px]" />
      </button>

      {!minimal && (
        <button
          onClick={() => getWindow().toggleMaximize()}
          className={`h-full w-12 flex items-center justify-center transition-colors ${iconButtonStyles}`}
        >
          <MdCheckBoxOutlineBlank className="size-[18px]" />
        </button>
      )}

      <button
        onClick={() => getWindow().close()}
        className="h-full w-12 flex items-center justify-center hover:bg-red-500 transition-colors group"
      >
        <MdClose className="size-[18px] text-[var(--neko-text-tertiary)] group-hover:text-white" />
      </button>
    </div>
  );
}