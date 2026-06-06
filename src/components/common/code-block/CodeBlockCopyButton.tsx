import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { writeTextToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { themeUiFeedbackTokens } from '@/styles/themeTokens';

interface CodeBlockCopyButtonProps {
  className?: string;
  content: string;
  copied?: boolean;
  onCopy?: (content: string) => Promise<boolean | void> | boolean | void;
  showLabels?: boolean;
  stopPropagation?: boolean;
}

export function CodeBlockCopyButton({
  className,
  content,
  copied = false,
  onCopy,
  showLabels = false,
  stopPropagation = false,
}: CodeBlockCopyButtonProps) {
  const { t } = useI18n();
  const suppressNextClickRef = useRef(false);
  const copiedTimerRef = useRef<number | null>(null);
  const [optimisticCopied, setOptimisticCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const triggerOptimisticCopied = () => {
    setOptimisticCopied(true);
    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current);
    }
    copiedTimerRef.current = window.setTimeout(() => {
      setOptimisticCopied(false);
      copiedTimerRef.current = null;
    }, themeUiFeedbackTokens.copyFeedbackDurationMs);
  };

  const handleCopy = async () => {
    try {
      if (onCopy) {
        const didCopy = await onCopy(content);
        if (didCopy !== false) {
          triggerOptimisticCopied();
        }
        return;
      }

      const didCopy = await writeTextToClipboard(content);
      if (didCopy) {
        triggerOptimisticCopied();
      }
    } catch (err) {
    }
  };

  const isCopied = copied || optimisticCopied;

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        if (stopPropagation) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (event.button !== 0) {
          return;
        }
        suppressNextClickRef.current = true;
        void handleCopy();
      }}
      onClick={(event) => {
        if (stopPropagation) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          return;
        }
        void handleCopy();
      }}
      className={cn('code-block-chrome-copy-button copy-code-button', className)}
      data-copied={isCopied ? 'true' : undefined}
      aria-label={isCopied ? t('common.copied') : t('common.copyCode')}
      title={isCopied ? t('common.copied') : t('common.copyToClipboard')}
    >
      <Icon
        name={isCopied ? 'common.check' : 'common.copy'}
        size="md"
        className={cn('transition-all duration-[var(--vlaina-duration-150)]', isCopied && 'scale-[var(--vlaina-scale-110)] text-[var(--vlaina-color-status-success-fg)]')}
      />
      {showLabels && (
        <span className="text-[var(--vlaina-font-11)] font-medium uppercase tracking-wider">
          {isCopied ? 'Copied' : 'Copy'}
        </span>
      )}
    </button>
  );
}
