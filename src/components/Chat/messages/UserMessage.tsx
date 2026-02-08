import { useState, useEffect, useRef } from 'react';
import { MdEdit, MdContentCopy, MdKeyboardArrowLeft, MdKeyboardArrowRight } from 'react-icons/md';
import { LocalImage } from '../components/LocalImage';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/ai/types';

interface UserMessageProps {
  message: ChatMessage;
  onEdit?: (id: string, newContent: string) => void;
  onSwitchVersion?: (id: string, targetIndex: number) => void;
}

export function UserMessage({ message, onEdit, onSwitchVersion }: UserMessageProps) {
  const content = message.content || '';
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const versions = message.versions || [];
  const currentIdx = message.currentVersionIndex ?? 0;
  const hasMultipleVersions = versions.length > 1;

  // Parse images for display mode
  const imgRegex = /!\[.*?\]\((.*?)\)/g;
  const images: string[] = [];
  let displayText = content;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
      images.push(match[1]);
  }
  displayText = displayText.replace(imgRegex, '').trim();

  // Reset edit value when content prop changes (if not currently editing)
  useEffect(() => {
      if (!isEditing) setEditValue(content);
  }, [content, isEditing]);

  // Auto-resize textarea
  useEffect(() => {
      if (isEditing && textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      }
  }, [isEditing, editValue]);

  const handleSave = () => {
      if (editValue.trim() !== content) {
          onEdit?.(message.id, editValue);
      }
      setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSave();
      }
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(content);
  };

  if (isEditing) {
      return (
          <div className="w-full max-w-3xl bg-[#F4F4F5] dark:bg-[#2C2C2C] rounded-xl p-4 border border-blue-500/20 shadow-sm animate-in fade-in zoom-in-95 duration-200">
              <textarea
                  ref={textareaRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent border-none outline-none resize-none text-[15px] leading-7 text-gray-900 dark:text-gray-100 font-mono"
                  rows={1}
                  autoFocus
              />
              <div className="flex justify-end gap-2 mt-3">
                  <button 
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                  >
                      Cancel
                  </button>
                  <button 
                      onClick={handleSave}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                  >
                      Save & Submit
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="group flex flex-col items-end gap-1 max-w-full">
        <div className="flex flex-col items-end gap-2">
            {images.map((src, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-black/5 dark:border-white/10 shadow-sm bg-white dark:bg-zinc-800">
                    <LocalImage 
                        src={src} 
                        alt="attachment" 
                        className="max-w-xs max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(src, '_blank')} 
                    />
                </div>
            ))}
            {displayText && (
                <div className="milkdown inline-block max-w-full bg-[#F4F4F5] dark:bg-[#2C2C2C] px-4 py-2 rounded-[20px] text-gray-900 dark:text-gray-100 text-[15px] leading-6 shadow-sm border border-black/5 dark:border-white/5 text-left break-words overflow-hidden">
                    <div className="whitespace-pre-wrap break-words">{displayText}</div>
                </div>
            )}
        </div>

        {/* Action Bar (Visible on Hover) */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 mr-1 mt-1">
            {/* Version Switcher */}
            {hasMultipleVersions && onSwitchVersion && (
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 rounded-md p-0.5 select-none">
                    <button 
                        onClick={() => {
                            console.log('[UserMessage] Prev clicked', { id: message.id, target: currentIdx - 1 });
                            currentIdx > 0 && onSwitchVersion(message.id, currentIdx - 1);
                        }}
                        disabled={currentIdx === 0}
                        className="p-0.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
                    >
                        <MdKeyboardArrowLeft size={14} />
                    </button>
                    <span className="text-[10px] font-mono font-medium text-gray-600 dark:text-gray-400 min-w-[24px] text-center">
                        {currentIdx + 1} / {versions.length}
                    </span>
                    <button 
                        onClick={() => {
                            console.log('[UserMessage] Next clicked', { id: message.id, target: currentIdx + 1 });
                            currentIdx < versions.length - 1 && onSwitchVersion(message.id, currentIdx + 1);
                        }}
                        disabled={currentIdx === versions.length - 1}
                        className="p-0.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
                    >
                        <MdKeyboardArrowRight size={14} />
                    </button>
                </div>
            )}

            <div className="flex items-center gap-1">
                <button 
                    onClick={handleCopy}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                >
                    <MdContentCopy size={14} />
                </button>
                
                <button 
                    onClick={() => {
                        if (onEdit) setIsEditing(true);
                    }}
                    className={cn(
                        "p-1.5 rounded-md transition-colors",
                        onEdit 
                            ? "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
                            : "text-gray-300 cursor-not-allowed"
                    )}
                    title={onEdit ? "Edit" : "Edit Unavailable"}
                >
                    <MdEdit size={14} />
                </button>
            </div>
        </div>
    </div>
  );
}