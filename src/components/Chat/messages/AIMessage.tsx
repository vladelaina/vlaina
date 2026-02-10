import { AnimatePresence, motion } from 'framer-motion';
import StreamingMarkdownContent from '../components/StreamingMarkdownContent';
import { CitationList } from './CitationList';
import { MessageToolbar } from './MessageToolbar';
import ThinkingBlock from '../components/ThinkingBlock';
import { ErrorBlock } from '../components/ErrorBlock';
import type { ChatMessage } from '@/lib/ai/types';

interface AIMessageProps {
  msg: ChatMessage;
  isSpeaking: boolean;
  isLoading: boolean;
  isSourcesOpen: boolean;
  onCopy: () => void;
  onSpeak: () => void;
  onRegenerate: () => void;
  onSwitchVersion: (targetIndex: number) => void;
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
  
  // 1. Parse Error Block
  const errorRegex = /<error(?: type="([^"]*)")?(?: code="([^"]*)")?>([\s\S]*?)<\/error>/;
  const errorMatch = errorRegex.exec(msg.content);
  const errorType = errorMatch ? errorMatch[1] : undefined;
  const errorCode = errorMatch ? errorMatch[2] : undefined;
  const errorContent = errorMatch ? errorMatch[3] : null;

  // Clean content by removing error block
  const contentWithoutError = msg.content.replace(errorRegex, '');

  // 2. Parse Thinking Block
  // Supports both <think>...</think> and just <think>... (streaming)
  const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/;
  const thinkMatch = thinkRegex.exec(contentWithoutError);
  
  const thinkContent = thinkMatch ? thinkMatch[1] : null;
  // Main content is everything AFTER the think block (if closed) or empty (if still thinking)
  let mainContent = contentWithoutError;
  if (thinkMatch) {
      const thinkEndIndex = contentWithoutError.indexOf('</think>');
      if (thinkEndIndex !== -1) {
          mainContent = contentWithoutError.substring(thinkEndIndex + 8).trim();
      } else {
          mainContent = ''; // Still thinking, nothing else to show yet
      }
  }
  
  // Determine if still thinking
  const isThinkingActive = isLoading && !!thinkContent && !contentWithoutError.includes('</think>');

  return (
    <div className="w-full pl-0">
        {/* Error Block - Highest Priority */}
        {errorContent && (
            <ErrorBlock type={errorType} code={errorCode} content={errorContent} />
        )}

        {/* Thinking Block (Ollama Style) */}
        {thinkContent && (
            <ThinkingBlock 
                thinking={thinkContent} 
                startTime={msg.createdAt ? new Date(msg.createdAt) : new Date()}
                endTime={!isThinkingActive ? new Date() : undefined} 
            />
        )}

        {/* Main Content (Ollama Style) */}
        {(mainContent.trim() || (isLoading && !isThinkingActive)) && (
            <div className="[&>*:last-child]:mb-0">
                <StreamingMarkdownContent 
                    content={mainContent || ' '} 
                    isStreaming={isLoading}
                />
            </div>
        )}
        
        {/* Toolbar */}
        {(!isLoading || mainContent) && !errorContent && (
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
        
        {/* Retry Button */}
        {errorContent && (
            <div className="mt-2">
                <button 
                    onClick={onRegenerate}
                    className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1"
                >
                    ⟳ Retry Generation
                </button>
            </div>
        )}
    </div>
  );
}