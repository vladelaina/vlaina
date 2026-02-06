import { useState } from 'react';
import { MdSend, MdAttachFile, MdImage } from 'react-icons/md';
import { cn } from '@/lib/utils';

export function ChatView() {
  const [message, setMessage] = useState('');

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
    <div className="h-full w-full flex flex-col bg-[var(--neko-bg-primary)]">
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
      <div className="p-4 pb-6">
        <div className="max-w-3xl mx-auto">
          <div 
            className={cn(
              "bg-white dark:bg-gray-800 rounded-[20px]",
              "shadow-[0_12px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.2)]",
              "border border-gray-200/50 dark:border-gray-700/50",
              "transition-all duration-200",
              "hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)]"
            )}
          >
            {/* Input Container */}
            <div className="flex flex-col">
              {/* Textarea */}
              <div className="relative px-4 pt-4">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="从任何想法开始… 按 Ctrl+Enter 换行..."
                  rows={1}
                  className={cn(
                    "w-full resize-none bg-transparent",
                    "text-[var(--neko-text-primary)] placeholder:text-gray-400 dark:placeholder:text-gray-500",
                    "focus:outline-none",
                    "text-sm leading-6"
                  )}
                  style={{
                    minHeight: '46px',
                    maxHeight: '320px',
                  }}
                />
              </div>

              {/* Bottom Bar */}
              <div className="flex items-center justify-between px-3 py-2">
                {/* Left Actions */}
                <div className="flex items-center gap-1">
                  {/* Attach File */}
                  <button
                    className={cn(
                      "w-9 h-9 flex items-center justify-center rounded-lg",
                      "text-gray-600 dark:text-gray-400",
                      "hover:bg-gray-100 dark:hover:bg-gray-700",
                      "transition-colors"
                    )}
                    title="附加文件"
                  >
                    <MdAttachFile className="w-5 h-5" />
                  </button>

                  {/* Image */}
                  <button
                    className={cn(
                      "w-9 h-9 flex items-center justify-center rounded-lg",
                      "text-gray-600 dark:text-gray-400",
                      "hover:bg-gray-100 dark:hover:bg-gray-700",
                      "transition-colors"
                    )}
                    title="添加图片"
                  >
                    <MdImage className="w-5 h-5" />
                  </button>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                  {/* Send Button */}
                  <button
                    onClick={handleSend}
                    disabled={!message.trim()}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      "transition-all duration-200",
                      message.trim()
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    )}
                    title="发送消息"
                  >
                    <MdSend className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
