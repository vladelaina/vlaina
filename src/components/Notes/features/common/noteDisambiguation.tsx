import { useDisplayName } from '@/hooks/useTitleSync';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { cn } from '@/lib/utils';

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
}

export function useNoteLabelDescriptor(path: string, fallbackName?: string): NoteLabelDescriptor {
  const displayName = useDisplayName(path);

  return {
    title: displayName?.trim() || fallbackName?.trim() || getNoteTitleFromPath(path),
    disambiguation: null,
  };
}

export function NoteDisambiguatedTitle({
  path,
  fallbackName,
  className,
  titleClassName,
  hintClassName,
}: NoteDisambiguatedTitleProps) {
  const { title, disambiguation } = useNoteLabelDescriptor(path, fallbackName);

  return (
    <span className={cn('block whitespace-normal break-all', className)}>
      <span className={titleClassName}>{title}</span>
      {disambiguation ? (
        <span className={cn('text-[11px]', hintClassName)}>{` · ${disambiguation}`}</span>
      ) : null}
    </span>
  );
}
