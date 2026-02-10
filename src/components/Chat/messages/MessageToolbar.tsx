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
  onCopy,
  onSpeak,
  onRegenerate,
  onSwitchVersion,
  onToggleSources,
  isSourcesOpen
}: MessageToolbarProps) {
  if (isLoading) return null;

  const versions = msg.versions || [msg.content];
  const currentIndex = msg.currentVersionIndex ?? 0;
  const currentVer = currentIndex + 1;
  const totalVer = versions.length;
  const hasCitations = msg.citations && msg.citations.length > 0;

  return (
    <div className="flex flex-col mt-1">
        <div className="flex items-center gap-2 select-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            
            {totalVer > 1 && (
                <div className="flex items-center text-xs font-medium text-gray-500 bg-gray-100 dark:bg-zinc-800 rounded-md px-1 mr-2">
                    <button onClick={() => onSwitchVersion(currentIndex - 1)} disabled={currentIndex <= 0} className="p-1 hover:text-black dark:hover:text-white disabled:opacity-30"><Icon name="nav.chevronLeft" size="sm"/></button>
                    <span className="mx-1">{currentVer} / {totalVer}</span>
                    <button onClick={() => onSwitchVersion(currentIndex + 1)} disabled={currentIndex >= totalVer - 1} className="p-1 hover:text-black dark:hover:text-white disabled:opacity-30"><Icon name="nav.chevronRight" size="sm"/></button>
                </div>
            )}
            
            <button onClick={onCopy} className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800" title="Copy">
                <Icon name="common.copy" size="sm" />
            </button>
            
            <button 
                onClick={onSpeak} 
                className={cn(
                    "p-1.5 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800",
                    isSpeaking ? "text-red-500" : "text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                )} 
                title={isSpeaking ? "Stop" : "Read Aloud"}
            >
                {isSpeaking ? <Icon name="media.stop" size="sm" /> : <Icon name="media.volume" size="sm" />}
            </button>

            <button onClick={onRegenerate} className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800" title="Regenerate">
                <Icon name="common.refresh" size="sm" />
            </button>

            {hasCitations && onToggleSources && (
                <button 
                    onClick={onToggleSources}
                    className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ml-1",
                        isSourcesOpen 
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" 
                            : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
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
