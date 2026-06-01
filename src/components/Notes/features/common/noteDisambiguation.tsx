import { useDisplayName } from '@/hooks/useTitleSync';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { useNotesStore } from '@/stores/useNotesStore';

interface NoteDisambiguatedTitleProps {
  path: string;
  fallbackName?: string;
  className?: string;
  titleClassName?: string;
  hintClassName?: string;
}

interface NoteLabelDescriptor {
  title: string;
  disambiguation: string | null;
  isUntitledPlaceholder: boolean;
}

export function useNoteLabelDescriptor(path: string, fallbackName?: string): NoteLabelDescriptor {
  const { t } = useI18n();
  const displayName = useDisplayName(path);
  const draftName = useNotesStore((state) => state.draftNotes[path]?.name);
  const isUntitledPlaceholder = isDraftNotePath(path) && !draftName?.trim();

  return {
    title: isUntitledPlaceholder
      ? t('notes.untitled')
      : displayName?.trim() || fallbackName?.trim() || getNoteTitleFromPath(path),
    disambiguation: null,
    isUntitledPlaceholder,
  };
}

export function NoteDisambiguatedTitle({
  path,
  fallbackName,
  className,
  titleClassName,
  hintClassName,
}: NoteDisambiguatedTitleProps) {
  const { title, disambiguation, isUntitledPlaceholder } = useNoteLabelDescriptor(path, fallbackName);

  return (
    <span className={cn('block whitespace-normal break-all', className)}>
      <span className={cn(titleClassName, isUntitledPlaceholder && 'text-[var(--vlaina-soft-placeholder)]')}>{title}</span>
      {disambiguation ? (
        <span className={cn('text-[var(--vlaina-font-11)]', hintClassName)}>{` · ${disambiguation}`}</span>
      ) : null}
    </span>
  );
}
