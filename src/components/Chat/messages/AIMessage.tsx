import { AnimatePresence, motion } from 'framer-motion';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { CitationList } from './CitationList';
import { MessageToolbar } from './MessageToolbar';
import type { ChatMessage } from '@/lib/ai/types';

interface AIMessageProps {
  msg: ChatMessage;
  isSpeaking: boolean;
  isLoading: boolean;
  isSourcesOpen: boolean;
  onCopy: () => void;
  onSpeak: () => void;
  onRegenerate: () => void;
  onSwitchVersion: (direction: 'prev' | 'next') => void;
  onToggleSources: () => void;
}

export function AIMessage({
  msg,
  isSpeaking,
  isLoading,
  isSourcesOpen,
  onCopy,
  onSpeak,
  onRegenerate,
  onSwitchVersion,
  onToggleSources
}: AIMessageProps) {
  
  return (
    <div className="w-full pl-0">
        <div className="[&>*:last-child]:mb-0">
            <MarkdownRenderer content={msg.content} />
        </div>
        
        {/* Toolbar */}
        <MessageToolbar 
            msg={msg}
            isSpeaking={isSpeaking}
            isLoading={isLoading}
            onCopy={onCopy}
            onSpeak={onSpeak}
            onRegenerate={onRegenerate}
            onSwitchVersion={onSwitchVersion}
            onToggleSources={onToggleSources}
            isSourcesOpen={isSourcesOpen}
        />

        {/* Expanded Sources Panel */}
        <AnimatePresence>
            {isSourcesOpen && msg.citations && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                >
                    <CitationList citations={msg.citations} />
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}
