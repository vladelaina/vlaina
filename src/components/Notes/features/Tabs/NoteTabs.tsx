/**
 * NoteTabs - Tab bar for multiple open notes
 * 
 * Modern block-editor style tab management
 */

import { memo } from 'react';
import { MdClose, MdDescription } from 'react-icons/md';
import { cn } from '@/lib/utils';
import { useDisplayName, useDisplayIcon } from '@/hooks/useTitleSync';
import { NoteIcon } from '../IconPicker/NoteIcon';

export interface NoteTab {
  path: string;
  name: string;
  isDirty: boolean;
}

interface SingleTabProps {
  tab: NoteTab;
  isActive: boolean;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onTabMiddleClick: (path: string) => void;
}

const SingleTab = memo(function SingleTab({ tab, isActive, onTabClick, onTabClose, onTabMiddleClick }: SingleTabProps) {
  const displayName = useDisplayName(tab.path);
  const icon = useDisplayIcon(tab.path);

  return (
    <div
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
        isActive
          ? "bg-[var(--neko-bg-primary)]"
          : "bg-transparent hover:bg-[var(--neko-hover)]"
      )}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--neko-accent)]" />
      )}

      {icon ? (
        <span className="flex-shrink-0">
          <NoteIcon icon={icon} size={18} />
        </span>
      ) : (
        <MdDescription
          className={cn(
            "w-[18px] h-[18px] flex-shrink-0",
            isActive
              ? "text-[var(--neko-accent)]"
              : "text-amber-500"
          )}
        />
      )}

      <span className={cn(
        "text-[12px] truncate",
        isActive
          ? "text-[var(--neko-text-primary)]"
          : "text-[var(--neko-text-secondary)]"
      )}>
        {displayName || tab.name}
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
        <MdClose className="w-[18px] h-[18px]" />
      </button>
    </div>
  );
});

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
        <SingleTab
          key={tab.path}
          tab={tab}
          isActive={activeTabPath === tab.path}
          onTabClick={onTabClick}
          onTabClose={onTabClose}
          onTabMiddleClick={onTabMiddleClick}
        />
      ))}
    </div>
  );
}