import { AnimatePresence, motion } from 'framer-motion';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { CitationList } from './CitationList';
import { MessageToolbar } from './MessageToolbar';
import { ThinkingBlock } from '../components/ThinkingBlock';
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
  
  // 1. Parse Error Block
  const errorRegex = /<error(?: type="([^"]*)")?(?: code="([^"]*)")?>([\s\S]*?)<\/error>/;
  const errorMatch = errorRegex.exec(msg.content);
  const errorType = errorMatch ? errorMatch[1] : undefined;
  const errorCode = errorMatch ? errorMatch[2] : undefined;
  const errorContent = errorMatch ? errorMatch[3] : null;

  // Clean content by removing error block for further parsing
  const contentWithoutError = msg.content.replace(errorRegex, '');

  // 2. Parse Thinking Block
  const thinkRegex = /^<think>([\s\S]*?)(?:<\/think>|$)([\s\S]*)/;
  const thinkMatch = thinkRegex.exec(contentWithoutError);
  
  const thinkContent = thinkMatch ? thinkMatch[1] : null;
  const mainContent = thinkMatch ? thinkMatch[2] : contentWithoutError;
  
  // Determine if still thinking
  const isThinkingActive = isLoading && !!thinkContent && !contentWithoutError.includes('</think>');

  return (
    <div className="w-full pl-0">
        {/* Error Block - Highest Priority */}
        {errorContent && (
            <ErrorBlock type={errorType} code={errorCode} content={errorContent} />
        )}

        {/* Thinking Block */}
        {thinkContent && (
            <ThinkingBlock 
                content={thinkContent} 
                isStreaming={isThinkingActive} 
            />
        )}

        {/* Main Content */}
        {/* Only render main content if it's not empty or we are actively thinking */}
        {(mainContent.trim() || isThinkingActive) && (
            <div className="[&>*:last-child]:mb-0">
                <MarkdownRenderer content={mainContent || (isThinkingActive ? '' : ' ')} />
            </div>
        )}
        
        {/* Toolbar - Hide if error occurred and no content */}
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
        
        {/* Retry Button for Errors */}
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
