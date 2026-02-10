import { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { motion, AnimatePresence } from 'framer-motion';

interface ErrorBlockProps {
  type?: string;
  code?: string;
  content: string;
}

export function ErrorBlock({ type, code, content }: ErrorBlockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const title = formatErrorTitle(type, code);

  const handleCopy = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-3 rounded-lg overflow-hidden border border-red-200/60 dark:border-red-900/40 bg-red-50/30 dark:bg-red-900/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left group transition-colors hover:bg-red-50/50 dark:hover:bg-red-900/20"
      >
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shrink-0">
            <Icon name="common.error" size="sm" />
        </div>
        
        <div className="flex-1 min-w-0">
            <h4 className="text-[13px] font-medium text-gray-800 dark:text-gray-200 truncate">
                {title}
            </h4>
        </div>

        {isOpen ? <Icon name="nav.chevronDown" size="sm" className="text-gray-400" /> : <Icon name="nav.chevronRight" size="sm" className="text-gray-400" />}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="relative px-3 pb-3 pt-0 border-t border-red-100/50 dark:border-red-900/20">
                <div className="mt-2 text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words leading-relaxed select-text bg-white/50 dark:bg-black/20 p-2 rounded border border-gray-100 dark:border-white/5">
                    {content}
                </div>
                
                <button 
                    onClick={handleCopy}
                    className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title="Copy Error Details"
                >
                    {copied ? <span className="text-[10px] font-bold text-green-500">Copied</span> : <Icon name="common.copy" size="xs" />}
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatErrorTitle(type?: string, code?: string): string {
    let base = "Generation Failed";
    if (type === 'NETWORK_ERROR') base = "Network Connection Issue";
    if (type === 'AUTH_ERROR') base = "Authentication Failed (API Key)";
    if (type === 'RATE_LIMIT') base = "Rate Limit Exceeded";
    if (type === 'TIMEOUT') base = "Request Timed Out";
    if (type === 'SERVER_ERROR') base = "Provider Server Error";
    
    if (code && code !== 'undefined') return `${base} (${code})`;
    return base;
}
