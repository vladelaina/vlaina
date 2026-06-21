import type { Ref } from 'react';
import { Icon } from '@/components/ui/icons';
import { NoteIcon } from '@/components/Notes/features/IconPicker/NoteIcon';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/useNotesStore';
import { shouldShowDirtyTabIndicator } from './dirtyTabIndicator';

interface NoteTabContentProps {
  tab: { path: string; name: string; isDirty: boolean };
  isActive: boolean;
  icon?: string;
  title: string;
  disambiguation?: string | null;
  isUntitledPlaceholder?: boolean;
  labelRef?: Ref<HTMLSpanElement>;
}

export function NoteTabContent({
  tab,
  isActive,
  icon,
  title,
  disambiguation,
  isUntitledPlaceholder = false,
  labelRef,
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
          className="pointer-events-none h-[var(--vlaina-size-18px)] w-[var(--vlaina-size-18px)] flex-shrink-0 text-[var(--vlaina-sidebar-notes-file-icon)]"
        />
      )}

      <span
        ref={labelRef}
        className={cn(
          'pointer-events-none truncate text-[var(--vlaina-font-13)] text-current',
          isActive && 'font-semibold',
          isUntitledPlaceholder && 'text-[var(--vlaina-soft-placeholder)]',
        )}
      >
        {title}
        {disambiguation ? (
          <span className="text-[var(--vlaina-font-11)] text-current/65">{` · ${disambiguation}`}</span>
        ) : null}
      </span>

      {showDirtyIndicator && (
        <span className="pointer-events-none h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--vlaina-accent)]" />
      )}
    </>
  );
}
