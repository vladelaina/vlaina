import { useState, useRef, useEffect, memo } from 'react';
import { MdSend, MdAttachFile, MdImage, MdSettings, MdStop, MdLanguage } from 'react-icons/md';
import { cn } from '@/lib/utils';
import { ModelSelector } from './ModelSelector';
import { useAIStore } from '@/stores/useAIStore';
import type { AIModel } from '@/lib/ai/types';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isLoading: boolean;
  selectedModel: AIModel | undefined;
  onOpenSettings: () => void;
}

export const ChatInput = memo(function ChatInput({ onSend, onStop, isLoading, selectedModel, onOpenSettings }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { webSearchEnabled, toggleWebSearch } = useAIStore();

  const handleSend = () => {
    if (!message.trim()) return;
    onSend(message);
    setMessage('');
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
      if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 320)}px`;
      }
  }, [message]);

  const canSend = !!message.trim() && !!selectedModel;

  return (
    <div className="p-4 pb-6">
        <div className="max-w-3xl mx-auto">
          <div 
            className={cn(
              "bg-white dark:bg-gray-800 rounded-[20px]",
              "border border-gray-200 dark:border-gray-700",
              "transition-all duration-200",
              webSearchEnabled && "ring-2 ring-blue-500/20 border-blue-200 dark:border-blue-800"
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
                        : (isLoading ? "Type to interrupt..." : "从任何想法开始… 按 Ctrl+Enter 换行...")
                  }
                  rows={1}
                  className={cn(
                    "w-full resize-none bg-transparent",
                    "text-[var(--neko-text-primary)] placeholder:text-gray-400 dark:placeholder:text-gray-500",
                    "focus:outline-none",
                    "text-sm leading-6",
                    "max-h-[320px]"
                  )}
                />
              </div>

              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={toggleWebSearch}
                    className={cn(
                      "w-9 h-9 flex items-center justify-center rounded-lg transition-all",
                      webSearchEnabled 
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" 
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
                    title={webSearchEnabled ? "禁用联网搜索" : "启用联网搜索"}
                  >
                    <MdLanguage className="w-5 h-5" />
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
                  
                  <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

                  <button
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="附加文件"
                  >
                    <MdAttachFile className="w-5 h-5" />
                  </button>

                  <button
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="添加图片"
                  >
                    <MdImage className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <ModelSelector />
                  
                  {isLoading && !message.trim() ? (
                      <button
                        onClick={onStop}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
                        title="停止生成"
                      >
                        <MdStop className="w-4 h-4" />
                      </button>
                  ) : (
                      <button
                        onClick={handleSend}
                        disabled={!canSend}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          "transition-all duration-200",
                          canSend
                            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                        )}
                        title={isLoading ? "发送并中断" : "发送消息"}
                      >
                        <MdSend className="w-4 h-4" />
                      </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
});
