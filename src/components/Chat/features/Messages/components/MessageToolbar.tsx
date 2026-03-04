import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import type { ChatMessage } from '@/lib/ai/types';

interface MessageToolbarProps {
  msg: ChatMessage;
  isLoading: boolean;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
  onSwitchVersion: (targetIndex: number) => void;
}

export function MessageToolbar({
  msg,
  isLoading,
  onCopy,
  onRegenerate,
  onSwitchVersion
}: MessageToolbarProps) {
  const [isCopied, setIsCopied] = useState(false);

  if (isLoading) return null;

  const versions = msg.versions || [msg.content];
  const currentIndex = msg.currentVersionIndex ?? 0;
  const currentVer = currentIndex + 1;
  const totalVer = versions.length;

  const handleCopy = () => {
      const cleanContent = msg.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim();
      onCopy(cleanContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col mt-1">
        <div className="flex items-center gap-1 select-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            
            {totalVer > 1 && (
                <div className="flex items-center text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors mr-2">
                    <button onClick={() => onSwitchVersion(currentIndex - 1)} disabled={currentIndex <= 0} className={cn("p-1 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 rounded", iconButtonStyles)}><Icon name="nav.chevronLeft" size="md"/></button>
                    <span className="mx-1 font-mono">{currentVer}/{totalVer}</span>
                    <button onClick={() => onSwitchVersion(currentIndex + 1)} disabled={currentIndex >= totalVer - 1} className={cn("p-1 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 rounded", iconButtonStyles)}><Icon name="nav.chevronRight" size="md"/></button>
                </div>
            )}
            
            <button 
                onClick={handleCopy} 
                className={cn("p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5", iconButtonStyles)} 
            >
                {isCopied ? <Icon name="common.check" size="md" /> : <Icon name="common.copy" size="md" />}
            </button>

            <button onClick={onRegenerate} className={cn("p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5", iconButtonStyles)}>
                <Icon name="common.refresh" size="md" />
            </button>
        </div>
    </div>
  );
}
