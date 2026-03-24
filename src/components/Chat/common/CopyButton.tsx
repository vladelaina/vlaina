import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  content: string;
  className?: string;
  showLabels?: boolean;
  copied?: boolean;
  onCopy?: (content: string) => Promise<void> | void;
}

export default function CopyButton({
  content,
  className,
  showLabels = false,
  copied = false,
  onCopy,
}: CopyButtonProps) {
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
        await onCopy(content);
        triggerOptimisticCopied();
        return;
      }

      await navigator.clipboard.writeText(content);
      triggerOptimisticCopied();
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const isCopied = copied || optimisticCopied;

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        suppressNextClickRef.current = true;
        void handleCopy();
      }}
      onClick={() => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          return;
        }
        void handleCopy();
      }}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md transition-[color,background-color,transform] duration-150 active:scale-[0.96]",
        "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
        "hover:bg-black/5 dark:hover:bg-white/5",
        className
      )}
      title={isCopied ? "Copied!" : "Copy to clipboard"}
    >
      <Icon
        name={isCopied ? "common.check" : "common.copy"}
        size="md"
        className={cn("transition-all duration-150", isCopied && "scale-110 text-green-500")}
      />
      {showLabels && (
        <span className="text-[11px] font-medium uppercase tracking-wider">
          {isCopied ? "Copied" : "Copy"}
        </span>
      )}
    </button>
  );
}
