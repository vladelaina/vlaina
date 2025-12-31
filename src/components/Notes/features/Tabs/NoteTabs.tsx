/**
 * NoteTabs - Tab bar for multiple open notes
 * 
 * Modern block-editor style tab management
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
    <div 
      className={cn(
        "flex items-center h-[36px] overflow-x-auto neko-scrollbar",
        "bg-[var(--neko-bg-secondary)] border-b border-[var(--neko-border)]"
      )}
    >
      {tabs.map((tab) => (
        <div
          key={tab.path}
          onClick={() => onTabClick(tab.path)}
          onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              onTabMiddleClick(tab.path);
            }
          }}
          className={cn(
            "group relative flex items-center gap-1.5 px-3 h-full cursor-pointer min-w-0 max-w-[180px]",
            "border-r border-[var(--neko-border)] transition-colors",
            activeTabPath === tab.path 
              ? "bg-[var(--neko-bg-primary)]" 
              : "bg-transparent hover:bg-[var(--neko-hover)]"
          )}
        >
          {/* Active indicator */}
          {activeTabPath === tab.path && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--neko-accent)]" />
          )}
          
          <FileTextIcon 
            className={cn(
              "w-3.5 h-3.5 flex-shrink-0",
              activeTabPath === tab.path 
                ? "text-[var(--neko-accent)]" 
                : "text-[var(--neko-icon-secondary)]"
            )} 
            weight="duotone" 
          />
          
          <span className={cn(
            "text-[12px] truncate",
            activeTabPath === tab.path 
              ? "text-[var(--neko-text-primary)]" 
              : "text-[var(--neko-text-secondary)]"
          )}>
            {tab.name}
          </span>
          
          {tab.isDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--neko-accent)] flex-shrink-0" />
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.path);
            }}
            className={cn(
              "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ml-auto",
              "hover:bg-[var(--neko-hover-filled)] text-[var(--neko-icon-secondary)]"
            )}
          >
            <XIcon className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
