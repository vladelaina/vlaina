import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/ai/types';

interface MessageToolbarProps {
  msg: ChatMessage;
  isSpeaking: boolean;
  isLoading: boolean;
  onCopy: () => void;
  onSpeak: () => void;
  onRegenerate: () => void;
  onSwitchVersion: (targetIndex: number) => void;
  onToggleSources?: () => void;
  isSourcesOpen?: boolean;
}

export function MessageToolbar({
  msg,
  isSpeaking,
  isLoading,
  onCopy: parentOnCopy, 
  onSpeak,
  onRegenerate,
  onSwitchVersion,
  onToggleSources,
  isSourcesOpen
}: MessageToolbarProps) {
  const [isCopied, setIsCopied] = useState(false);

  if (isLoading) return null;

  const versions = msg.versions || [msg.content];
  const currentIndex = msg.currentVersionIndex ?? 0;
  const currentVer = currentIndex + 1;
  const totalVer = versions.length;
  const hasCitations = msg.citations && msg.citations.length > 0;

  const handleCopy = () => {
      // Strip <think> tags for clean copying
      const cleanContent = msg.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim();
      navigator.clipboard.writeText(cleanContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col mt-1">
        <div className="flex items-center gap-1 select-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            
            {totalVer > 1 && (
                <div className="flex items-center text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors mr-2">
                    <button onClick={() => onSwitchVersion(currentIndex - 1)} disabled={currentIndex <= 0} className="p-1 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 rounded"><Icon name="nav.chevronLeft" size="xs"/></button>
                    <span className="mx-1 font-mono">{currentVer}/{totalVer}</span>
                    <button onClick={() => onSwitchVersion(currentIndex + 1)} disabled={currentIndex >= totalVer - 1} className="p-1 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 rounded"><Icon name="nav.chevronRight" size="xs"/></button>
                </div>
            )}
            
            <button 
                onClick={handleCopy} 
                className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/5" 
                title="Copy"
            >
                {isCopied ? <Icon name="common.check" size="md" className="text-green-500" /> : <Icon name="common.copy" size="md" />}
            </button>
            
            <button 
                onClick={onSpeak} 
                className={cn(
                    "p-1.5 transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/5",
                    isSpeaking ? "text-red-500" : "text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                )} 
                title={isSpeaking ? "Stop" : "Read Aloud"}
            >
                {isSpeaking ? <Icon name="media.stop" size="md" /> : <Icon name="media.volume" size="md" />}
            </button>

            <button onClick={onRegenerate} className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/5" title="Regenerate">
                <Icon name="common.refresh" size="md" />
            </button>

            {hasCitations && onToggleSources && (
                <button 
                    onClick={onToggleSources}
                    className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ml-1",
                        isSourcesOpen 
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" 
                            : "bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-zinc-700"
                    )}
                >
                    <Icon name="common.language" size="xs" />
                    <span>Sources</span>
                    <span className="opacity-60">{msg.citations?.length}</span>
                    {isSourcesOpen ? <Icon name="nav.chevronUp" size="xs"/> : <Icon name="nav.chevronDown" size="xs"/>}
                </button>
            )}
        </div>
    </div>
  );
}
