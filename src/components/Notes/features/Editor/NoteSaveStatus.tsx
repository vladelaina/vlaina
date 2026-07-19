import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { getErrorDiagnosticDetails } from '@/lib/diagnostics/errorDetails';
import { logDiagnostic } from '@/lib/diagnostics/diagnosticsLog';
import { useNotesStore } from '@/stores/useNotesStore';
import { isDraftNotePath } from '@/stores/notes/draftNote';

export function NoteSaveStatus({ notePath }: { notePath: string | null | undefined }) {
  const { t } = useI18n();
  const isDirty = useNotesStore((state) => state.isDirty);
  const saveError = useNotesStore((state) => state.saveError);
  const saveErrorPath = useNotesStore((state) => state.saveErrorPath);
  const hasSaveError = Boolean(saveError && saveErrorPath === notePath && isDirty);

  useEffect(() => {
    if (!hasSaveError || !saveError) return;
    logDiagnostic('note-save', 'save-error-visible', getErrorDiagnosticDetails(saveError));
  }, [hasSaveError, saveError]);

  const label = hasSaveError ? t('storage.saveFailed') : null;

  if (!label || !notePath || isDraftNotePath(notePath)) {
    return null;
  }

  return (
    <span
      aria-live="polite"
      className="self-center whitespace-nowrap text-xs text-[var(--vlaina-text-tertiary)]"
      data-note-save-status="error"
      role="status"
    >
      {label}
    </span>
  );
}
