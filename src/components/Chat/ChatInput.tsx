import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { ModelSelector } from './ModelSelector';
import { useAIStore } from '@/stores/useAIStore';
import type { AIModel } from '@/lib/ai/types';
import { saveAttachment, type Attachment } from '@/lib/storage/attachmentStorage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface ChatInputProps {
  onSend: (message: string, attachments: Attachment[]) => void;
  onStop: () => void;
  isLoading: boolean;
  selectedModel: AIModel | undefined;
  focusTrigger?: number;
}

export const ChatInput = memo(function ChatInput({ onSend, onStop, isLoading, selectedModel, focusTrigger }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { webSearchEnabled, toggleWebSearch } = useAIStore();

  useEffect(() => {
      if (focusTrigger && textareaRef.current) {
          textareaRef.current.focus();
      }
  }, [focusTrigger]);

  const handleSend = () => {
    if (!message.trim() && attachments.length === 0) return;
    onSend(message, attachments);
    setMessage('');
    setAttachments([]);
    
    requestAnimationFrame(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const processFiles = async (files: File[]) => {
      const newAttachments: Attachment[] = [];
      for (const file of files) {
          try {
              const attachment = await saveAttachment(file);
              newAttachments.push(attachment);
          } catch (e) {
              console.error(e);
          }
      }
      if (newAttachments.length > 0) {
          setAttachments(prev => [...prev, ...newAttachments]);
      }
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const files = items
          .filter(item => item.kind === 'file')
          .map(item => item.getAsFile())
          .filter((f): f is File => !!f);
      
      if (files.length > 0) {
          e.preventDefault();
          await processFiles(files);
      }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      await processFiles(files);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  }, []);

  const removeAttachment = (id: string) => {
      setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const triggerFileSelect = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          await processFiles(Array.from(e.target.files));
      }
      e.target.value = ''; 
  };

  useEffect(() => {
      if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 320)}px`;
      }
  }, [message]);

  const canSend = (!!message.trim() || attachments.length > 0) && !!selectedModel;

  return (
    <div className="p-4 pb-6">
        <div className="max-w-3xl mx-auto relative">
          <input 
              type="file" 
              multiple 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
          />
          
          {isDragging && (
              <div className="absolute inset-0 z-20 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-[32px] flex items-center justify-center backdrop-blur-sm pointer-events-none">
                  <span className="text-blue-600 font-medium">Drop files here</span>
              </div>
          )}

          <div 
            className={cn(
              "relative z-10",
              "bg-white/80 dark:bg-[#18181b]/80 backdrop-blur-xl",
              "border border-black/5 dark:border-white/10",
              "rounded-[32px]", 
              "shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]", 
              "transition-all duration-300 ease-out",
              "hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
              "focus-within:ring-1 focus-within:ring-black/5 dark:focus-within:ring-white/10", 
              webSearchEnabled && "ring-2 ring-blue-500/20 border-blue-200 dark:border-blue-800"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col px-1">
              {attachments.length > 0 && (
                  <div className="px-4 pt-4 pb-0 flex gap-2 overflow-x-auto scrollbar-none">
                      {attachments.map(att => (
                          <div key={att.id} className="relative group shrink-0">
                              {att.type.startsWith('image/') ? (
                                  <img src={att.previewUrl} alt="preview" className="h-16 w-16 object-cover rounded-xl border border-black/5 dark:border-white/10" />
                              ) : (
                                  <div className="h-16 w-16 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center border border-black/5 dark:border-white/10">
                                      <Icon name="file.attach" className="text-gray-400" />
                                  </div>
                              )}
                              <button 
                                  onClick={() => removeAttachment(att.id)}
                                  className="absolute -top-1.5 -right-1.5 bg-gray-200 dark:bg-zinc-700 text-gray-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                              >
                                  <Icon name="common.close" size="xs" />
                              </button>
                          </div>
                      ))}
                  </div>
              )}

              <div className="relative px-4 pt-4 pb-2">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={
                      !selectedModel 
                        ? "Select a model..." 
                        : (isLoading ? "Type to interrupt..." : "Message...")
                  }
                  rows={1}
                  className={cn(
                    "w-full resize-none bg-transparent",
                    "text-[15px] leading-6 text-[var(--neko-text-primary)]",
                    "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                    "focus:outline-none",
                    "max-h-[320px] min-h-[24px]"
                  )}
                />
              </div>

              <div className="flex items-center justify-between px-2 pb-2 pl-3">
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button 
                                className={cn(
                                    "w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200",
                                    "text-gray-500 dark:text-gray-400",
                                    "hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200 active:scale-95"
                                )}
                            >
                                <Icon name="common.add" className="w-5 h-5" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" sideOffset={8} className="w-48 bg-white dark:bg-[#1E1E1E]">
                            <DropdownMenuItem onClick={toggleWebSearch} className="gap-2 cursor-pointer">
                                <Icon name="common.language" className={cn("w-4 h-4", webSearchEnabled ? "text-blue-500" : "text-gray-500")} />
                                <span>Web Search</span>
                                {webSearchEnabled && <span className="ml-auto text-[10px] bg-blue-100 text-blue-600 px-1.5 rounded-full">ON</span>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={triggerFileSelect} className="gap-2 cursor-pointer">
                                <Icon name="file.attach" className="w-4 h-4 text-gray-500" />
                                <span>Attach File</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={triggerFileSelect} className="gap-2 cursor-pointer">
                                <Icon name="file.image" className="w-4 h-4 text-gray-500" />
                                <span>Add Image</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {webSearchEnabled && (
                        <button
                            onClick={toggleWebSearch}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all animate-in fade-in zoom-in duration-200",
                                "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
                                "hover:bg-blue-200 dark:hover:bg-blue-900/50"
                            )}
                        >
                            <Icon name="common.language" className="w-3.5 h-3.5" />
                            <span>Search</span>
                            <div className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800 ml-0.5">
                                <span className="text-[10px] font-bold">×</span>
                            </div>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                  <ModelSelector />
                  
                  {isLoading && !message.trim() ? (
                      <button
                        onClick={onStop}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 bg-gray-100 dark:bg-white text-black dark:text-black shadow-sm hover:scale-105 active:scale-95"
                      >
                        <Icon name="media.stop" className="w-4 h-4" />
                      </button>
                  ) : (
                      <button
                        onClick={handleSend}
                        disabled={!canSend}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200",
                          canSend
                            ? "bg-black text-white shadow-md hover:scale-105 active:scale-95"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-default"
                        )}
                      >
                        <Icon name="common.send" className="w-3.5 h-3.5" />
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
