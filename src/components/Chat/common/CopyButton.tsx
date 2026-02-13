import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  content: string;
  className?: string;
  showLabels?: boolean;
}

export default function CopyButton({ content, className, showLabels = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors",
        "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
        "hover:bg-black/5 dark:hover:bg-white/5",
        className
      )}
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      <Icon name={copied ? "common.check" : "common.copy"} size="sm" className={cn(copied && "text-green-500")} />
      {showLabels && (
        <span className="text-[11px] font-medium uppercase tracking-wider">
          {copied ? "Copied" : "Copy"}
        </span>
      )}
    </button>
  );
}
