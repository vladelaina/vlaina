import { AnimatePresence, motion } from 'framer-motion';
import StreamingMarkdownContent from '../components/StreamingMarkdownContent';
import { CitationList } from './CitationList';
import { MessageToolbar } from './MessageToolbar';
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
  
  const errorRegex = /<error(?: type="([^"]*)")?(?: code="([^"]*)")?>([\s\S]*?)<\/error>/;
  const errorMatch = errorRegex.exec(msg.content);
  const errorType = errorMatch ? errorMatch[1] : undefined;
  const errorCode = errorMatch ? errorMatch[2] : undefined;
  const errorContent = errorMatch ? errorMatch[3] : null;

  const contentWithoutError = msg.content.replace(errorRegex, '');

  return (
    <div className="w-full pl-0">
        <div className="[&>*:last-child]:mb-0">
            <StreamingMarkdownContent 
                content={contentWithoutError || ' '} 
                isStreaming={isLoading}
                startTime={msg.createdAt ? new Date(msg.createdAt) : undefined}
            />
        </div>

        {errorContent && (
            <div className="mt-2">
                <ErrorBlock 
                    type={errorType} 
                    code={errorCode} 
                    content={errorContent} 
                />
            </div>
        )}
        
        {/* Toolbar - Always visible to allow version switching */}
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

        {!errorContent && (
            <>
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
