import { ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Settings } from 'lucide-react';
import { NotePencil, CalendarBlank } from '@phosphor-icons/react';
import { WindowControls } from './WindowControls';
import { useUIStore } from '@/stores/uiSlice';

const appWindow = getCurrentWindow();

interface TitleBarProps {
  onOpenSettings?: () => void;
  toolbar?: ReactNode;
  content?: ReactNode;
  /** When true, window controls are hidden (shown in right panel instead) */
  hideWindowControls?: boolean;
}

export function TitleBar({ onOpenSettings, toolbar, content, hideWindowControls }: TitleBarProps) {
  const { appViewMode, toggleAppViewMode } = useUIStore();
  
  const startDrag = async () => {
    await appWindow.startDragging();
  };

  return (
    <div 
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) startDrag();
      }}
      className="h-10 bg-white dark:bg-zinc-900 flex items-center select-none relative z-50 border-b border-zinc-200 dark:border-zinc-800"
    >
      {/* Left: Settings Button */}
      <button
        onClick={onOpenSettings}
        className="h-full px-3 flex items-center justify-center hover:bg-zinc-100 transition-colors z-20"
        title="Settings"
      >
        <Settings className="size-4 text-zinc-200 hover:text-zinc-400 dark:text-zinc-700 dark:hover:text-zinc-500" />
      </button>

      {/* Notes/Calendar Toggle Button */}
      <button
        onClick={toggleAppViewMode}
        className="h-full px-3 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-20"
        title={appViewMode === 'calendar' ? 'Switch to Notes' : 'Switch to Calendar'}
      >
        {appViewMode === 'calendar' ? (
          <NotePencil className="size-4 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300" weight="duotone" />
        ) : (
          <CalendarBlank className="size-4 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300" weight="duotone" />
        )}
      </button>

      {/* Center Content Area - Absolutely positioned for true centering */}
      <div 
        onMouseDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).hasAttribute('data-tauri-drag-region')) {
            startDrag();
          }
        }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        data-tauri-drag-region
      >
        <div className="pointer-events-auto">
          {content}
        </div>
      </div>

      {/* Spacer to push toolbar and controls to the right */}
      <div className="flex-1" />

      {/* Custom Toolbar (e.g., Calendar controls) */}
      {toolbar && (
        <div className="flex items-center h-full z-20 pr-3">
          {toolbar}
        </div>
      )}

      {/* Window Controls - only show when right panel is hidden */}
      {!hideWindowControls && <WindowControls className="z-50" />}
    </div>
  );
}
