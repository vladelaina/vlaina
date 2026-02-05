import { useState } from 'react';
import { MdSend, MdAdd, MdMenu } from 'react-icons/md';
import { cn } from '@/lib/utils';

export function ChatView() {
  const [message, setMessage] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleSend = () => {
    if (!message.trim()) return;
    // TODO: Implement send message
    console.log('Send message:', message);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full w-full flex bg-[var(--neko-bg-primary)]">
      {/* Sidebar - Chat History */}
      {isSidebarOpen && (
        <div className="w-64 border-r border-[var(--neko-border)] flex flex-col bg-[var(--neko-bg-secondary)]">
          {/* Sidebar Header */}
          <div className="p-3 border-b border-[var(--neko-border)]">
            <button
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg",
                "bg-[var(--neko-bg-primary)] hover:bg-[var(--neko-hover)]",
                "text-[var(--neko-text-primary)] text-sm font-medium",
                "transition-colors"
              )}
            >
              <MdAdd className="w-5 h-5" />
              New chat
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {/* Placeholder chat items */}
              <button
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg",
                  "hover:bg-[var(--neko-hover)]",
                  "text-[var(--neko-text-secondary)] text-sm",
                  "transition-colors truncate"
                )}
              >
                New chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-[var(--neko-border)] flex items-center px-4 gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg",
              "hover:bg-[var(--neko-hover)] transition-colors"
            )}
          >
            <MdMenu className="w-5 h-5 text-[var(--neko-text-secondary)]" />
          </button>
          <h2 className="text-sm font-semibold text-[var(--neko-text-primary)]">
            NekoTick AI
          </h2>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-8">
            {/* Welcome Message */}
            <div className="text-center py-12">
              <h1 className="text-3xl font-semibold text-[var(--neko-text-primary)] mb-2">
                有什么可以帮忙的？
              </h1>
              <p className="text-sm text-[var(--neko-text-tertiary)] mt-2">
                NekoTick AI 助手随时为您服务
              </p>
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-[var(--neko-border)] p-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="有问题，尽管问"
                  rows={1}
                  className={cn(
                    "w-full px-4 py-3 pr-12 rounded-xl resize-none",
                    "bg-[var(--neko-bg-secondary)] border border-[var(--neko-border)]",
                    "text-[var(--neko-text-primary)] placeholder:text-[var(--neko-text-tertiary)]",
                    "focus:outline-none focus:ring-2 focus:ring-[var(--neko-accent)]",
                    "transition-all"
                  )}
                  style={{
                    minHeight: '48px',
                    maxHeight: '200px',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className={cn(
                    "absolute right-2 bottom-2 w-8 h-8 rounded-lg",
                    "flex items-center justify-center transition-all",
                    message.trim()
                      ? "bg-[var(--neko-accent)] text-white hover:bg-[var(--neko-accent-hover)]"
                      : "bg-[var(--neko-bg-tertiary)] text-[var(--neko-text-tertiary)] cursor-not-allowed"
                  )}
                >
                  <MdSend className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-[var(--neko-text-tertiary)] text-center mt-2">
              NekoTick AI 可能会出错，请核查重要信息
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
