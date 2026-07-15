import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { writeTextToClipboard } from '@/lib/clipboard';
import { useI18n } from '@/lib/i18n';
import { themeUiFeedbackTokens } from '@/styles/themeTokens';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { cn } from '@/lib/utils';

export function ModelBenchmarkErrorInfo({ error }: { error: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
  }, []);

  const handleCopy = async () => {
    if (!await writeTextToClipboard(error)) return;
    setCopied(true);
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, themeUiFeedbackTokens.copiedResetDelayMs);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${t('common.copy')}: ${error}`}
          onClick={(event) => {
            event.stopPropagation();
            void handleCopy();
          }}
          onKeyDown={(event) => event.stopPropagation()}
          className="flex h-5 w-5 shrink-0 items-center justify-center text-[var(--vlaina-color-status-danger-fg)] transition-colors hover:text-[var(--vlaina-sidebar-row-selected-text)]"
        >
          <Icon name={copied ? 'common.check' : 'common.info'} size="xs" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        showArrow={false}
        className={cn(
          'max-w-[var(--vlaina-width-toast-max)] rounded-[var(--vlaina-radius-18px)] px-3 py-2 text-center text-xs text-[var(--vlaina-sidebar-chat-text)]',
          chatComposerPillSurfaceClass,
        )}
      >
        {copied ? t('common.copied') : error}
      </TooltipContent>
    </Tooltip>
  );
}
