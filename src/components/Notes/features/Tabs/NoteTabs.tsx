import { memo } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { useNoteLabelDescriptor } from '../common/noteDisambiguation';
import { useNotesStore } from '@/stores/useNotesStore';
import { shouldShowDirtyTabIndicator } from './dirtyTabIndicator';
import { truncateNoteLabel } from '../common/truncateNoteLabel';

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
  const { title, disambiguation, isUntitledPlaceholder } = useNoteLabelDescriptor(tab.path, tab.name);
  const notesPath = useNotesStore((s) => s.notesPath);
  const draftNote = useNotesStore((s) => s.draftNotes[tab.path]);
  const hasSaveError = useNotesStore((s) => (
    Boolean(s.saveError) && s.saveErrorPath === tab.path
  ));
  const showDirtyIndicator = shouldShowDirtyTabIndicator({
    path: tab.path,
    isDirty: tab.isDirty,
    isActive,
    notesPath,
    draftNote,
    hasSaveError,
  });

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
        "group relative flex items-center gap-1.5 px-3 h-full cursor-pointer min-w-0 max-w-[var(--vlaina-size-180px)]",
        "border-r border-[var(--vlaina-border)] transition-colors",
        isActive
          ? "bg-[var(--vlaina-bg-primary)]"
          : "bg-transparent hover:bg-[var(--vlaina-hover)]"
      )}
    >
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-[var(--vlaina-size-2px)] bg-[var(--vlaina-accent)]" />
      )}

      {icon ? (
        <span className="flex-shrink-0">
          <NoteIcon icon={icon} notePath={tab.path} size="md" />
        </span>
      ) : (
        <Icon
          name="file.text"
          className={cn(
            "w-[var(--vlaina-size-18px)] h-[var(--vlaina-size-18px)] flex-shrink-0",
            "text-[var(--vlaina-sidebar-notes-file-icon)]"
          )}
        />
      )}

      <span className={cn(
        "text-[var(--vlaina-font-xs)] truncate",
        isUntitledPlaceholder
          ? "text-[var(--vlaina-soft-placeholder)]"
          : isActive
          ? "text-[var(--vlaina-text-primary)]"
          : "text-[var(--vlaina-text-secondary)]"
      )}>
        {truncateNoteLabel(title)}
        {disambiguation ? (
          <span className="text-[var(--vlaina-font-11)] text-current/65">{` · ${disambiguation}`}</span>
        ) : null}
      </span>

      {showDirtyIndicator && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--vlaina-accent)] flex-shrink-0" />
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onTabClose(tab.path);
        }}
        className={cn(
          "p-0.5 rounded opacity-[var(--vlaina-opacity-0)] group-hover:opacity-[var(--vlaina-opacity-100)] transition-opacity ml-auto",
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
        "flex items-center h-[var(--vlaina-size-36px)] overflow-x-auto app-scrollbar",
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
