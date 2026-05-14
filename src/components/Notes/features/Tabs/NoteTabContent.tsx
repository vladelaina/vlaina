import { Icon } from '@/components/ui/icons';
import { NoteIcon } from '@/components/Notes/features/IconPicker/NoteIcon';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/useNotesStore';
import { shouldShowDirtyTabIndicator } from './dirtyTabIndicator';
import { truncateNoteLabel } from '../common/truncateNoteLabel';

interface NoteTabContentProps {
  tab: { path: string; name: string; isDirty: boolean };
  isActive: boolean;
  icon?: string;
  title: string;
  disambiguation?: string | null;
}

export function NoteTabContent({
  tab,
  isActive,
  icon,
  title,
  disambiguation,
}: NoteTabContentProps) {
  const notesPath = useNotesStore((s) => s.notesPath);
  const draftNote = useNotesStore((s) => s.draftNotes[tab.path]);
  const hasSaveError = useNotesStore((s) => Boolean(s.error));
  const showDirtyIndicator = shouldShowDirtyTabIndicator({
    path: tab.path,
    isDirty: tab.isDirty,
    isActive,
    notesPath,
    draftNote,
    hasSaveError,
  });

  return (
    <>
      {icon ? (
        <span className="pointer-events-none flex-shrink-0">
          <NoteIcon icon={icon} notePath={tab.path} size="md" />
        </span>
      ) : (
        <Icon
          name="file.text"
          className="pointer-events-none h-[18px] w-[18px] flex-shrink-0 text-[var(--notes-sidebar-file-icon)]"
        />
      )}

      <span className={cn('pointer-events-none truncate text-[13px] text-current', isActive && 'font-semibold')}>
        {truncateNoteLabel(title)}
        {disambiguation ? (
          <span className="text-[11px] text-current/65">{` · ${disambiguation}`}</span>
        ) : null}
      </span>

      {showDirtyIndicator && (
        <span className="pointer-events-none h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--vlaina-accent)]" />
      )}
    </>
  );
}
