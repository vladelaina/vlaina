import { useMemo, useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/icons';
import {
  clearChatDebugLog,
  formatChatDebugLog,
  getChatDebugLogSnapshot,
  subscribeChatDebugLog,
} from '@/lib/debug/chatDebugLog';
import { cn } from '@/lib/utils';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ChatDebugLogButton() {
  const [isOpen, setIsOpen] = useState(false);
  const entries = useSyncExternalStore(
    subscribeChatDebugLog,
    getChatDebugLogSnapshot,
    getChatDebugLogSnapshot,
  );
  const latestEntries = useMemo(() => entries.slice(-80).reverse(), [entries]);

  const copyLogs = async () => {
    await navigator.clipboard?.writeText(formatChatDebugLog(entries)).catch(() => undefined);
  };

  return (
    <div className="absolute bottom-3 right-3 z-40 flex items-end gap-2" data-chat-selection-excluded="true">
      {isOpen && (
        <div
          className={cn(
            'flex h-[min(460px,calc(100vh-120px))] w-[min(560px,calc(100vw-24px))] flex-col overflow-hidden rounded-[18px] border border-black/5 bg-[var(--vlaina-bg-primary)] text-[12px] shadow-lg',
            chatComposerPillSurfaceClass,
          )}
        >
          <div className="flex h-10 items-center gap-2 border-b border-black/5 px-3">
            <div className="font-medium text-[var(--vlaina-text-primary)]">Chat logs</div>
            <div className="text-[var(--vlaina-text-tertiary)]">{entries.length} entries</div>
            <button
              type="button"
              onClick={copyLogs}
              className="ml-auto h-7 rounded-md px-2 text-[var(--vlaina-text-secondary)] hover:bg-black/5"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={clearChatDebugLog}
              className="h-7 rounded-md px-2 text-[var(--vlaina-text-secondary)] hover:bg-black/5"
            >
              Clear
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[11px] leading-5">
            {latestEntries.length === 0 ? (
              <div className="text-[var(--vlaina-text-tertiary)]">No logs yet.</div>
            ) : (
              latestEntries.map((entry) => (
                <div key={entry.id} className="border-b border-black/[0.04] py-1">
                  <div className="flex min-w-0 gap-2">
                    <span className="shrink-0 text-[var(--vlaina-text-tertiary)]">{formatTime(entry.timestamp)}</span>
                    <span className="shrink-0 uppercase text-[var(--vlaina-text-tertiary)]">{entry.level}</span>
                    <span className="shrink-0 text-[var(--vlaina-accent)]">{entry.scope}</span>
                    <span className="min-w-0 break-words text-[var(--vlaina-text-primary)]">{entry.message}</span>
                  </div>
                  {entry.data && (
                    <pre className="mt-1 whitespace-pre-wrap break-words text-[var(--vlaina-text-tertiary)]">
                      {JSON.stringify(entry.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label={isOpen ? 'Close chat logs' : 'Open chat logs'}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          'flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-[12px] font-medium text-[var(--vlaina-text-primary)] shadow-sm transition-colors hover:bg-black/5',
          chatComposerPillSurfaceClass,
        )}
      >
        <Icon name="misc.activity" size={16} />
        <span className="ml-1.5">{entries.length}</span>
      </button>
    </div>
  );
}
