import { AnimatePresence, motion } from 'framer-motion';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { CitationList } from './CitationList';
import { MessageToolbar } from './MessageToolbar';
import { ThinkingBlock } from '../components/ThinkingBlock';
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
  
  // Parse <think> block
  // Pattern: <think> ... </think> ...
  const thinkRegex = /^<think>([\s\S]*?)(?:<\/think>|$)([\s\S]*)/;
  const match = thinkRegex.exec(msg.content);
  
  const thinkContent = match ? match[1] : null;
  const mainContent = match ? match[2] : msg.content;
  
  // Determine if still thinking (streaming and tag not closed)
  // If isLoading is true AND we have thinkContent but NO mainContent (or tag not closed)
  // But regex catches (?:</think>|$) so we can't easily tell if closed.
  // Better check: if msg.content includes '</think>', then thinking is done.
  const isThinkingActive = isLoading && !!thinkContent && !msg.content.includes('</think>');

  return (
    <div className="w-full pl-0">
        {/* Thinking Block */}
        {thinkContent && (
            <ThinkingBlock 
                content={thinkContent} 
                isStreaming={isThinkingActive} 
            />
        )}

        {/* Main Content */}
        <div className="[&>*:last-child]:mb-0">
            <MarkdownRenderer content={mainContent || (isThinkingActive ? '' : ' ')} />
        </div>
        
        {/* Toolbar */}
        {(!isLoading || mainContent) && (
            <>
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
            </>
        )}
    </div>
  );
}