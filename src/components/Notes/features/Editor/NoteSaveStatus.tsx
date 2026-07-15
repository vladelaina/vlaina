import { useI18n } from '@/lib/i18n';
import { useNotesStore } from '@/stores/useNotesStore';
import { isDraftNotePath } from '@/stores/notes/draftNote';

export function NoteSaveStatus({ notePath }: { notePath: string | null | undefined }) {
  const { t } = useI18n();
  const isDirty = useNotesStore((state) => state.isDirty);
  const error = useNotesStore((state) => state.error);
  const hasSaveError = Boolean(error && isDirty);

  if (!hasSaveError || !notePath || isDraftNotePath(notePath)) {
    return null;
  }

  return (
    <span
      aria-live="polite"
      className="self-center whitespace-nowrap text-xs text-[var(--vlaina-text-tertiary)]"
      data-note-save-status="error"
      role="status"
    >
      {t('storage.saveFailed')}
    </span>
  );
}
