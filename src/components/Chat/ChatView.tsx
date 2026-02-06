import { useState } from 'react';
import { MdSend, MdAttachFile, MdImage, MdSettings } from 'react-icons/md';
import { cn } from '@/lib/utils';
import { ModelSelector } from './ModelSelector';
import { useAIStore } from '@/stores/useAIStore';
import { newAPIClient } from '@/lib/ai/providers/newapi';

export function ChatView() {
  const [message, setMessage] = useState('');
  
  const { 
    messages: allMessages, 
    currentSessionId,
    createSession,
    addMessage, 
    updateMessage, 
    getSelectedModel, 
    providers, 
    isLoading, 
    setLoading, 
    setError 
  } = useAIStore();

  const messages = currentSessionId ? (allMessages[currentSessionId] || []) : [];
  const selectedModel = getSelectedModel();

  const handleSend = async () => {
    if (!message.trim() || !selectedModel) return;

    const provider = providers.find(p => p.id === selectedModel.providerId);
    if (!provider) {
      setError('Provider not found');
      return;
    }

    const userMessage = message.trim();
    setMessage('');
    
    // Auto-create session if none exists
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
        activeSessionId = createSession(userMessage.slice(0, 30));
    }

    // Ensure we are switched to it (createSession does this, but for safety)
    if (activeSessionId !== currentSessionId) {
        // We rely on store update, but addMessage uses get().currentSessionId
        // createSession runs synchronously, so store should be updated.
    }
    
    addMessage({
      role: 'user',
      content: userMessage,
      modelId: selectedModel.id
    });

    const assistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    addMessage({
      role: 'assistant',
      content: '',
      modelId: selectedModel.id
    });

    setLoading(true);
    setError(null);

    try {
      await newAPIClient.sendMessage(
        userMessage,
        selectedModel,
        provider,
        (chunk) => {
          updateMessage(assistantMessageId, chunk);
        }
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send message');
      updateMessage(assistantMessageId, '❌ Failed to get response');
    } finally {
      setLoading(false);
    }
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
          {messages.length === 0 ? (
            <div className="text-center py-12">
              {!selectedModel && (
                <button
                  onClick={() => {
                    const event = new CustomEvent('open-settings', { detail: { tab: 'ai' } })
                    window.dispatchEvent(event)
                  }}
                  className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  配置 AI 提供商
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] px-4 py-2 rounded-2xl",
                      msg.role === 'user'
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-2xl">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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
            <div className="flex flex-col">
              <div className="relative px-4 pt-4">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="从任何想法开始… 按 Ctrl+Enter 换行..."
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
                    onClick={() => {
                      const event = new CustomEvent('open-settings', { detail: { tab: 'ai' } })
                      window.dispatchEvent(event)
                    }}
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
    </div>
  );
}
