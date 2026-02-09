import { useState } from 'react';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';

interface ThinkingBlockProps {
  content: string;
  isStreaming: boolean;
}

export function ThinkingBlock({ content, isStreaming }: ThinkingBlockProps) {
  const [isOpen, setIsOpen] = useState(isStreaming); // Auto-open while streaming

  return (
    <div className="mb-3 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden bg-gray-50/50 dark:bg-white/5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
      >
        {isOpen ? <MdKeyboardArrowDown size={16} /> : <MdKeyboardArrowRight size={16} />}
        {isStreaming ? (
            <span className="animate-pulse">Thinking...</span>
        ) : (
            <span>Thought Process</span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 pb-3 pt-0 text-gray-500 dark:text-gray-400 text-[13px] leading-relaxed font-mono whitespace-pre-wrap border-t border-gray-100 dark:border-gray-800/50">
                {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
