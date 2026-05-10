import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { writeTextToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';

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
    }, 1200);
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
      console.error('Failed to copy text: ', err);
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
      className={cn('vlaina-code-block-copy-button', className)}
      data-copied={isCopied ? 'true' : undefined}
      aria-label={isCopied ? 'Copied' : 'Copy code'}
      title={isCopied ? 'Copied!' : 'Copy to clipboard'}
    >
      <Icon
        name={isCopied ? 'common.check' : 'common.copy'}
        size="md"
        className={cn('transition-all duration-150', isCopied && 'scale-110 text-green-500')}
      />
      {showLabels && (
        <span className="text-[11px] font-medium uppercase tracking-wider">
          {isCopied ? 'Copied' : 'Copy'}
        </span>
      )}
    </button>
  );
}
