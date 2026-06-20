import { useCallback, useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/components/ui/icons';
import { writeTextToClipboard } from '@/lib/clipboard';
import { cn, iconButtonStyles } from '@/lib/utils';

const DIAGNOSTICS_BUTTON_CLASS =
  'pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border border-[var(--vlaina-border)] bg-[var(--vlaina-color-setting-field)] shadow-[var(--vlaina-shadow-sm)] backdrop-blur-[var(--vlaina-backdrop-blur-sm)] transition-colors hover:bg-[var(--vlaina-hover)]';
const COPY_FEEDBACK_MS = 1200;

type ProductionDiagnosticsButtonProps = {
  forceVisible?: boolean;
  // Keep this as a copy-only entry point; callers choose which log text to provide.
  getLogText: () => string | Promise<string>;
};

export function ProductionDiagnosticsButton({
  forceVisible = false,
  getLogText,
}: ProductionDiagnosticsButtonProps) {
  const [copied, setCopied] = useState(false);
  const handleCopyLogs = useCallback(async () => {
    const logText = await getLogText();
    const copied = await writeTextToClipboard(logText);
    if (copied) {
      setCopied(true);
    }
  }, [getLogText]);

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
