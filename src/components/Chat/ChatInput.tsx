import { useState, useRef, useEffect, memo } from 'react';
import { MdSend, MdAttachFile, MdImage, MdSettings } from 'react-icons/md';
import { cn } from '@/lib/utils';
import { ModelSelector } from './ModelSelector';
import type { AIModel } from '@/lib/ai/types';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  selectedModel: AIModel | undefined;
  onOpenSettings: () => void;
}

export const ChatInput = memo(function ChatInput({ onSend, isLoading, selectedModel, onOpenSettings }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!message.trim() || isLoading || !selectedModel) return;
    onSend(message);
    setMessage('');
    // Reset height?
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 pb-6">
        <div className="max-w-3xl mx-auto">
          <div 
            className={cn(
              "bg-white dark:bg-gray-800 rounded-[20px]",
              "border border-gray-200 dark:border-gray-700",
              "transition-all duration-200"
            )}
          >
            <div className="flex flex-col">
              <div className="relative px-4 pt-4">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                      !selectedModel 
                        ? "Please select a model to start chat..." 
                        : isLoading 
                            ? "AI is thinking..." 
                            : "从任何想法开始… 按 Ctrl+Enter 换行..."
                  }
                  rows={1}
                  disabled={isLoading || !selectedModel}
                  className={cn(
                    "w-full resize-none bg-transparent",
                    "text-[var(--neko-text-primary)] placeholder:text-gray-400 dark:placeholder:text-gray-500",
                    "focus:outline-none",
                    "text-sm leading-6",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  style={{
                    minHeight: '46px',
                    maxHeight: '320px',
                  }}
                />
              </div>

              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-1">
                  <ModelSelector />
                  
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

                  <button
                    onClick={onOpenSettings}
                    className={cn(
                      "w-9 h-9 flex items-center justify-center rounded-lg",
                      "text-gray-600 dark:text-gray-400",
                      "hover:bg-gray-100 dark:hover:bg-gray-700",
                      "transition-colors"
                    )}
                    title="AI 设置"
                  >
                    <MdSettings className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || isLoading || !selectedModel}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      "transition-all duration-200",
                      message.trim() && selectedModel && !isLoading
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
  );
});
