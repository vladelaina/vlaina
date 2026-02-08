import { MdContentCopy, MdVolumeUp, MdRefresh, MdNavigateBefore, MdNavigateNext, MdStop, MdLanguage, MdKeyboardArrowDown, MdKeyboardArrowUp } from 'react-icons/md';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/ai/types';

interface MessageToolbarProps {
  msg: ChatMessage;
  isSpeaking: boolean;
  isLoading: boolean;
  onCopy: () => void;
  onSpeak: () => void;
  onRegenerate: () => void;
  onSwitchVersion: (direction: 'prev' | 'next') => void;
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
  const currentVer = (msg.currentVersionIndex ?? 0) + 1;
  const totalVer = versions.length;
  const hasCitations = msg.citations && msg.citations.length > 0;

  return (
    <div className="flex flex-col mt-1">
        <div className="flex items-center gap-2 select-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            
            {totalVer > 1 && (
                <div className="flex items-center text-xs font-medium text-gray-500 bg-gray-100 dark:bg-zinc-800 rounded-md px-1 mr-2">
                    <button onClick={() => onSwitchVersion('prev')} disabled={currentVer <= 1} className="p-1 hover:text-black dark:hover:text-white disabled:opacity-30"><MdNavigateBefore size={14}/></button>
                    <span className="mx-1">{currentVer} / {totalVer}</span>
                    <button onClick={() => onSwitchVersion('next')} disabled={currentVer >= totalVer} className="p-1 hover:text-black dark:hover:text-white disabled:opacity-30"><MdNavigateNext size={14}/></button>
                </div>
            )}
            
            <button onClick={onCopy} className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800" title="Copy">
                <MdContentCopy size={14} />
            </button>
            
            <button 
                onClick={onSpeak} 
                className={cn(
                    "p-1.5 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800",
                    isSpeaking ? "text-red-500" : "text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                )} 
                title={isSpeaking ? "Stop" : "Read Aloud"}
            >
                {isSpeaking ? <MdStop size={14} /> : <MdVolumeUp size={14} />}
            </button>

            <button onClick={onRegenerate} className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800" title="Regenerate">
                <MdRefresh size={14} />
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
                    <MdLanguage size={12} />
                    <span>Sources</span>
                    <span className="opacity-60">{msg.citations?.length}</span>
                    {isSourcesOpen ? <MdKeyboardArrowUp size={12}/> : <MdKeyboardArrowDown size={12}/>}
                </button>
            )}
        </div>
    </div>
  );
}
