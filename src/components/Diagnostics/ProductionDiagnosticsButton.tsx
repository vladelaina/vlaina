import { useCallback, useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/components/ui/icons';
import { formatDiagnosticLog, recordDiagnostic } from '@/lib/diagnostics/appDiagnostics';
import { writeTextToClipboard } from '@/lib/clipboard';
import { cn, iconButtonStyles } from '@/lib/utils';

const DIAGNOSTICS_BUTTON_CLASS =
  'pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border border-[var(--vlaina-border)] bg-[var(--vlaina-color-setting-field)] shadow-[var(--vlaina-shadow-sm)] backdrop-blur-[var(--vlaina-backdrop-blur-sm)] transition-colors hover:bg-[var(--vlaina-hover)]';
const COPY_FEEDBACK_MS = 1200;

export function ProductionDiagnosticsButton({ forceVisible = false }: { forceVisible?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopyLogs = useCallback(async () => {
    const logText = formatDiagnosticLog();
    const copied = await writeTextToClipboard(logText);
    recordDiagnostic('diagnostics', copied ? 'copy_logs_success' : 'copy_logs_failed', {
      length: logText.length,
    });
    if (copied) {
      setCopied(true);
    }
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timeoutId = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  if (!forceVisible && !import.meta.env.PROD) {
    return null;
  }

  return (
    <Tooltip delayDuration={700}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => void handleCopyLogs()}
          aria-label="Copy diagnostic logs"
          data-diagnostics-copy-logs="true"
          data-copied={copied ? 'true' : 'false'}
          className={cn(DIAGNOSTICS_BUTTON_CLASS, iconButtonStyles)}
        >
          <Icon name={copied ? 'common.check' : 'common.copy'} size="md" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        <span className="text-[var(--vlaina-font-xs)]">Copy diagnostic logs</span>
      </TooltipContent>
    </Tooltip>
  );
}
