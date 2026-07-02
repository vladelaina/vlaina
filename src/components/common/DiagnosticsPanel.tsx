import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { writeTextToClipboard } from '@/lib/clipboard';
import {
  clearDiagnosticsLog,
  getDiagnosticsEntryCount,
  getDiagnosticsLogText,
  subscribeDiagnostics,
} from '@/lib/diagnostics/diagnosticsLog';

export function DiagnosticsPanel() {
  const [entryCount, setEntryCount] = useState(() => getDiagnosticsEntryCount());
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    return subscribeDiagnostics(() => {
      setEntryCount(getDiagnosticsEntryCount());
    });
  }, []);

  const handleCopy = useCallback(async () => {
    const copied = await writeTextToClipboard(getDiagnosticsLogText());
    setCopyState(copied ? 'copied' : 'failed');
    window.setTimeout(() => {
      setCopyState('idle');
    }, 1200);
  }, []);

  const handleClear = useCallback(() => {
    clearDiagnosticsLog();
    setCopyState('idle');
  }, []);

  const copyAriaLabel = copyState === 'copied'
    ? 'Copied'
    : copyState === 'failed'
      ? 'Copy failed'
      : 'Copy diagnostics';

  return (
    <div
      data-diagnostics-panel="true"
      className={cn(
        'fixed bottom-4 right-4 z-[var(--vlaina-z-max)] flex max-w-[calc(100vw_-_var(--vlaina-size-32px))] items-center gap-1.5 rounded-full border border-[var(--vlaina-color-subtle-border)] bg-[var(--vlaina-color-setting-panel)] px-2 py-1.5 text-[var(--vlaina-font-xs)] text-[var(--vlaina-sidebar-notes-text)] shadow-[var(--vlaina-shadow-lg)]',
      )}
    >
      <span
        aria-label={`${entryCount} diagnostics entries`}
        className="min-w-5 rounded-full px-1.5 text-center font-medium tabular-nums text-[var(--vlaina-sidebar-notes-text-soft)]"
      >
        {entryCount}
      </span>
      <button
        type="button"
        aria-label={copyAriaLabel}
        data-diagnostics-action="copy"
        onClick={() => void handleCopy()}
        className="inline-flex size-7 items-center justify-center rounded-full text-[var(--vlaina-sidebar-row-selected-text)] transition-colors hover:bg-[var(--vlaina-sidebar-row-selected-bg)]"
      >
        <Icon name={copyState === 'copied' ? 'common.check' : 'common.copy'} size="xs" />
      </button>
      <button
        type="button"
        aria-label="Clear diagnostics"
        data-diagnostics-action="clear"
        onClick={handleClear}
        className="inline-flex size-7 items-center justify-center rounded-full text-[var(--vlaina-sidebar-notes-text-soft)] transition-colors hover:bg-[var(--vlaina-bg-tertiary)] hover:text-[var(--vlaina-sidebar-notes-text)]"
      >
        <Icon name="common.delete" size="xs" />
      </button>
    </div>
  );
}
