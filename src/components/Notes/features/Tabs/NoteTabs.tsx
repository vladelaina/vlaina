import { memo } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { useNoteLabelDescriptor } from '../common/noteDisambiguation';

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
  const icon = useDisplayIcon(tab.path);
  const { title, disambiguation } = useNoteLabelDescriptor(tab.path, tab.name);

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
        "border-r border-[var(--vlaina-border)] transition-colors",
        isActive
          ? "bg-[var(--vlaina-bg-primary)]"
          : "bg-transparent hover:bg-[var(--vlaina-hover)]"
      )}
    >
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--vlaina-accent)]" />
      )}

      {icon ? (
        <span className="flex-shrink-0">
          <NoteIcon icon={icon} notePath={tab.path} size="md" />
        </span>
      ) : (
        <Icon
          name="file.text"
          className={cn(
            "w-[18px] h-[18px] flex-shrink-0",
            "text-[var(--notes-sidebar-file-icon)]"
          )}
        />
      )}

      <span className={cn(
        "text-[12px] truncate",
        isActive
          ? "text-[var(--vlaina-text-primary)]"
          : "text-[var(--vlaina-text-secondary)]"
      )}>
        {title}
        {disambiguation ? (
          <span className="text-[11px] text-current/65">{` · ${disambiguation}`}</span>
        ) : null}
      </span>

      {tab.isDirty && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--vlaina-accent)] flex-shrink-0" />
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onTabClose(tab.path);
        }}
        className={cn(
          "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ml-auto",
          "hover:bg-[var(--vlaina-hover-filled)] text-[var(--vlaina-icon-secondary)]"
        )}
      >
 <Icon size="md" name="common.close" />
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
        "flex items-center h-[36px] overflow-x-auto vlaina-scrollbar",
        "bg-[var(--vlaina-bg-secondary)] border-b border-[var(--vlaina-border)]"
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
