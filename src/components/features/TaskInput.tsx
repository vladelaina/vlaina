import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGroupStore } from '@/stores/useGroupStore';

export function TaskInput() {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { addTask, activeGroupId } = useGroupStore();

  const handleSubmit = () => {
    if (content.trim() && activeGroupId) {
      addTask(content.trim(), activeGroupId);
      setContent('');
      // Keep focus for rapid entry
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [content]);

  return (
    <motion.div
      initial={false}
      animate={{
        backgroundColor: isFocused 
          ? 'hsl(var(--muted) / 0.3)' 
          : 'transparent',
      }}
      className={cn(
        'flex items-start gap-2 px-2 py-2 rounded-md',
        'border transition-all duration-200',
        isFocused 
          ? 'border-border/60' 
          : 'border-transparent hover:border-border/30'
      )}
    >
      {/* Plus Icon */}
      <AnimatePresence mode="wait">
        <motion.button
          onClick={handleSubmit}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'p-1 rounded transition-colors',
            content.trim() 
              ? 'text-foreground hover:bg-muted' 
              : 'text-muted-foreground/50'
          )}
          aria-label="Add task"
        >
          <Plus className="h-4 w-4" />
        </motion.button>
      </AnimatePresence>
      
      <textarea
        ref={inputRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder="Type a new task... (Shift+Enter for new line)"
        rows={1}
        className={cn(
          'flex-1 bg-transparent border-none outline-none resize-none',
          'text-sm text-foreground placeholder:text-muted-foreground/50',
          'focus:ring-0 leading-relaxed min-h-[24px] max-h-[200px]'
        )}
      />

      {/* Character hint when typing */}
      <AnimatePresence>
        {content.trim() && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="text-xs text-muted-foreground/50 select-none"
          >
            ↵
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
