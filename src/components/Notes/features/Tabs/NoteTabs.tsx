/**
 * NoteTabs - Tab bar for multiple open notes
 * 
 * Obsidian-style tab management
 */

import { XIcon, FileTextIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface NoteTab {
  path: string;
  name: string;
  isDirty: boolean;
}

interface NoteTabsProps {
  tabs: NoteTab[];
  activeTabPath: string | null;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onTabMiddleClick: (path: string) => void;
}

export function NoteTabs({ 
  tabs, 
  activeTabPath, 
  onTabClick, 
  onTabClose,
  onTabMiddleClick 
}: NoteTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.path}
          onClick={() => onTabClick(tab.path)}
          onMouseDown={(e) => {
            if (e.button === 1) { // Middle click
              e.preventDefault();
              onTabMiddleClick(tab.path);
            }
          }}
          className={cn(
            "group flex items-center gap-1.5 px-3 py-1.5 border-r border-zinc-200 dark:border-zinc-800 cursor-pointer min-w-0 max-w-48",
            "hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors",
            activeTabPath === tab.path 
              ? "bg-white dark:bg-zinc-900 border-b-2 border-b-purple-500 -mb-px" 
              : "bg-zinc-50 dark:bg-zinc-900/50"
          )}
        >
          <FileTextIcon 
            className={cn(
              "size-3.5 flex-shrink-0",
              activeTabPath === tab.path 
                ? "text-purple-500" 
                : "text-zinc-400"
            )} 
            weight="duotone" 
          />
          
          <span className={cn(
            "text-xs truncate",
            activeTabPath === tab.path 
              ? "text-zinc-900 dark:text-zinc-100" 
              : "text-zinc-600 dark:text-zinc-400"
          )}>
            {tab.name}
          </span>
          
          {tab.isDirty && (
            <span className="size-1.5 rounded-full bg-blue-500 flex-shrink-0" />
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.path);
            }}
            className={cn(
              "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity",
              "hover:bg-zinc-200 dark:hover:bg-zinc-700"
            )}
          >
            <XIcon className="size-3 text-zinc-400" />
          </button>
        </div>
      ))}
    </div>
  );
}
