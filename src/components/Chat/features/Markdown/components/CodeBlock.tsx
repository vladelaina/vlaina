import { memo, useMemo } from 'react';
import 'highlight.js/styles/github-dark.css';
import CopyButton from '@/components/Chat/common/CopyButton';
import { chatHighlighter } from '../utils/chatHighlighter';

interface CodeBlockProps {
  className?: string;
  children: React.ReactNode;
}

export const CodeBlock = memo(({ className, children }: CodeBlockProps) => {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const codeText = String(children).replace(/\n$/, "");

  const highlightedHTML = useMemo(() => {
    try {
      if (language && chatHighlighter.getLanguage(language)) {
        return chatHighlighter.highlight(codeText, { language }).value;
      }
      return chatHighlighter.highlightAuto(codeText).value;
    } catch (e) {
      return codeText;
    }
  }, [codeText, language]);

  return (
    <div className="relative bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-hidden my-6 group">
      <div className="flex select-none px-4 py-2 items-center justify-between">
        <span className="text-[13px] text-neutral-500 dark:text-neutral-400 font-mono">
            {language || 'text'}
        </span>
        <CopyButton
          content={codeText}
          showLabels={false}
          className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
        />
      </div>
      <div className="overflow-x-auto p-4 pt-0">
        <code 
            className={`font-mono text-sm leading-relaxed hljs ${language} !bg-transparent !p-0`}
            dangerouslySetInnerHTML={{ __html: highlightedHTML }}
        />
      </div>
    </div>
  );
});
