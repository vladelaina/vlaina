import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useNotesStore } from '@/stores/useNotesStore';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { themeUiFeedbackTokens } from '@/styles/themeTokens';

export function NoteSaveStatus({ notePath }: { notePath: string | null | undefined }) {
  const { t } = useI18n();
  const isDirty = useNotesStore((state) => state.isDirty);
  const error = useNotesStore((state) => state.error);
  const hasSaveError = Boolean(error && isDirty);
  const [showSaved, setShowSaved] = useState(false);
  const wasDirtyRef = useRef(false);

  useEffect(() => {
    if (!notePath || isDraftNotePath(notePath)) {
      wasDirtyRef.current = false;
      setShowSaved(false);
      return;
    }

    if (isDirty) {
      wasDirtyRef.current = true;
      setShowSaved(false);
      return;
    }

    if (!wasDirtyRef.current || hasSaveError) {
      return;
    }

    wasDirtyRef.current = false;
    setShowSaved(true);
    const timeout = window.setTimeout(
      () => setShowSaved(false),
      themeUiFeedbackTokens.editorSavedStatusDurationMs,
    );
    return () => window.clearTimeout(timeout);
  }, [hasSaveError, isDirty, notePath]);

  const label = hasSaveError
    ? t('storage.saveFailed')
    : isDirty
      ? t('common.saving')
      : showSaved
        ? t('common.saved')
        : null;

  if (!label || !notePath || isDraftNotePath(notePath)) {
    return null;
  }

  return (
    <span
      aria-live="polite"
      className="self-center whitespace-nowrap text-xs text-[var(--vlaina-text-tertiary)]"
      data-note-save-status={hasSaveError ? 'error' : isDirty ? 'saving' : 'saved'}
      role="status"
    >
      {label}
    </span>
  );
}
